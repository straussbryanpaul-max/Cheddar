import Anthropic from '@anthropic-ai/sdk'
import type { CCMonthlyAnalysis, CCTransaction, CCMerchantMemory, AmazonSubscribeItem } from '../types'

export type StatementFile =
  | { type: 'csv'; content: string }
  | { type: 'pdf'; base64: string }

// Compact transaction shape Claude outputs — redundant fields added client-side
interface RawTransaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  isRecurring: boolean
  person?: string | null
}

interface RawAnalysis {
  id: string
  month: string
  statementRange: string
  notes: string
  transactions: RawTransaction[]
  reductionSuggestions: CCMonthlyAnalysis['reductionSuggestions']
}

const ANALYSIS_PROMPT = `You are analyzing a Barclays Arrival Mastercard credit card statement for a personal budgeting app. The statement may list transactions under separate sections per authorized cardholder (e.g. "BRYAN STRAUSS" / "RACHEL STRAUSS").

Analyze every credit card charge and return compact JSON. Be terse — short descriptions are fine.

For each transaction:
1. Category — pick one: Groceries, Dining, Gas, Amazon, Streaming, Entertainment, Healthcare, Home & Garden, Shopping, Travel, Clothing, Personal Care, Insurance, Utilities, Other
2. isRecurring — true if subscription, insurance, utility, or same merchant appears monthly
3. person — first name of the cardholder whose section this charge appears under (e.g. "Bryan" or "Rachel"). Omit if the statement does not separate by cardholder.
4. Skip payments TO Barclays and refund credits
5. Infer statement period from dates in the document

Return ONLY this JSON (no markdown, no explanation). Omit optional fields when null/false to save space:
{
  "id": "2026-04",
  "month": "April 2026",
  "statementRange": "Apr 1 – Apr 30",
  "notes": "2-3 sentence summary",
  "transactions": [
    {"id":"tx1","date":"2026-04-15","description":"NETFLIX","amount":15.99,"category":"Streaming","isRecurring":true,"person":"Bryan"},
    {"id":"tx2","date":"2026-04-20","description":"WALMART","amount":93.42,"category":"Groceries","isRecurring":false,"person":"Rachel"}
  ],
  "reductionSuggestions": [
    {"id":"sug1","description":"Specific actionable tip","potentialSavings":25,"dismissed":false}
  ]
}

Rules:
- amount always positive
- transaction ids: tx1, tx2, ...  suggestion ids: sug1, sug2, ...
- potentialSavings: number or null
- 3-5 suggestions based on what you actually see`

function buildMemorySection(memory: CCMerchantMemory): string {
  const entries = Object.entries(memory)
  if (entries.length === 0) return ''
  const lines = entries.map(([merchant, m]) =>
    `  "${merchant}" → ${m.category}${m.isRecurring ? ' (recurring)' : ''}${m.person ? `, person: ${m.person}` : ''}`
  )
  return `\n\nPreviously learned merchant categorizations — use these unless there is strong evidence to categorize differently:\n${lines.join('\n')}`
}

export async function analyzeCreditCard(
  statement: StatementFile,
  apiKey: string,
  merchantMemory: CCMerchantMemory = {},
): Promise<CCMonthlyAnalysis> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const memorySection = buildMemorySection(merchantMemory)
  const fullPrompt = ANALYSIS_PROMPT + memorySection

  const userContent: Anthropic.MessageParam['content'] =
    statement.type === 'pdf'
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: statement.base64 } },
          { type: 'text', text: fullPrompt },
        ]
      : fullPrompt +
        `\n\nBarclays CC statement CSV:\n\`\`\`\n${statement.content}\n\`\`\``

  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 16000,
    messages: [{ role: 'user', content: userContent }],
  })

  const response = await stream.finalMessage()
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')

  const raw = textBlock.text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON found in response')

  const parsed = JSON.parse(raw.slice(start, end + 1)) as RawAnalysis

  // Expand compact transactions to full CCTransaction shape
  const transactions: CCTransaction[] = parsed.transactions.map(tx => ({
    id: tx.id,
    date: tx.date,
    description: tx.description,
    amount: tx.amount,
    barclaysCategory: '',
    aiCategory: tx.category,
    category: tx.category,
    aiIsRecurring: tx.isRecurring,
    isRecurring: tx.isRecurring,
    isAmazon: false,
    amazonType: null,
    amazonItemDescription: null,
    person: (tx.person as CCTransaction['person']) ?? null,
    flagged: false,
  }))

  // Use a unique id so two uploads of the same month don't overwrite each other.
  // parsed.id is YYYY-MM from Claude; we suffix with a timestamp for uniqueness.
  return {
    id: `${parsed.id}-${Date.now()}`,
    month: parsed.month,
    statementRange: parsed.statementRange,
    savedAt: new Date().toISOString().split('T')[0],
    notes: parsed.notes,
    transactions,
    reductionSuggestions: parsed.reductionSuggestions,
  }
}

// ─── Amazon Subscribe & Save matching ────────────────────────────────────────

interface SSMatchCandidate {
  id: string
  date: string
  amount: number
}

const SS_MATCH_PROMPT = `You match Amazon Subscribe & Save deliveries against credit card charges.

You are given:
1. A persistent list of Subscribe & Save items, each with an expected per-shipment cost, a delivery frequency in months (can be fractional — e.g. 0.5 means twice a month / roughly every 2 weeks), and a known past delivery date. From the past date and frequency you can extrapolate all expected delivery dates (e.g. lastDelivered=2025-07-12, frequencyMonths=2 → expect deliveries in Sep, Nov, Jan, Mar, May ... in both directions; frequencyMonths=0.5 → expect deliveries roughly every 14-15 days).
2. A statement period (date range).
3. A list of Amazon charges on Rachel's card that fell inside that period.

Decide which charges are Subscribe & Save deliveries vs one-off Amazon purchases:
- A charge is a Subscribe & Save match if its amount is close to a list item's amount (within ~$1 or ~10%, accounting for small tax/price drift) AND an extrapolated delivery from that item is expected within the statement period (±10 days slack).
- Multiple charges may match the same item if the cadence places multiple deliveries in the period (rare, but possible).
- A single charge can only match one item.
- Charges that don't satisfy both conditions are one-offs.

Return ONLY this JSON (no markdown):
{
  "matches": [
    {"txId": "tx5", "itemName": "Coffee Pods"},
    {"txId": "tx9", "itemName": "Dog Food"}
  ]
}

Only include matched charges in the array. Charges not in the array are treated as one-offs.`

export async function matchAmazonSubscribeSave(
  items: AmazonSubscribeItem[],
  candidates: SSMatchCandidate[],
  statementRange: string,
  apiKey: string,
): Promise<string[]> {
  if (items.length === 0 || candidates.length === 0) return []

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const itemsBlock = items
    .map(i => `  - ${i.name}: $${i.amount.toFixed(2)}, every ${i.frequencyMonths} month(s), lastDelivered ${i.lastDelivered}`)
    .join('\n')

  const candidatesBlock = candidates
    .map(c => `  - id=${c.id}, date=${c.date}, amount=$${c.amount.toFixed(2)}`)
    .join('\n')

  const userText = `${SS_MATCH_PROMPT}

Statement period: ${statementRange}

Subscribe & Save list:
${itemsBlock}

Amazon charges on Rachel's card during this period:
${candidatesBlock}`

  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 4000,
    messages: [{ role: 'user', content: userText }],
  })

  const response = await stream.finalMessage()
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')

  const raw = textBlock.text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON found in response')

  const parsed = JSON.parse(raw.slice(start, end + 1)) as { matches: { txId: string; itemName: string }[] }
  return parsed.matches.map(m => m.txId)
}

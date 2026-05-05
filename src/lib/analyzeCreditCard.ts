import Anthropic from '@anthropic-ai/sdk'
import type { CCMonthlyAnalysis, CCTransaction, CCMerchantMemory } from '../types'

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
  isAmazon?: boolean
  amazonType?: CCTransaction['amazonType']
  amazonItemDescription?: string | null
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
  amazonCsvContent: string | null,
  apiKey: string,
  merchantMemory: CCMerchantMemory = {},
): Promise<CCMonthlyAnalysis> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const amazonSection = amazonCsvContent
    ? `\n\nAmazon Order History CSV:\n\`\`\`\n${amazonCsvContent}\n\`\`\``
    : ''

  const memorySection = buildMemorySection(merchantMemory)
  const fullPrompt = ANALYSIS_PROMPT + memorySection

  const userContent: Anthropic.MessageParam['content'] =
    statement.type === 'pdf'
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: statement.base64 } },
          { type: 'text', text: fullPrompt + amazonSection },
        ]
      : fullPrompt +
        `\n\nBarclays CC statement CSV:\n\`\`\`\n${statement.content}\n\`\`\`` +
        amazonSection

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
    isAmazon: tx.isAmazon ?? false,
    amazonType: tx.amazonType ?? null,
    amazonItemDescription: tx.amazonItemDescription ?? null,
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

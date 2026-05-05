import Anthropic from '@anthropic-ai/sdk'
import type { CCMonthlyAnalysis, CCTransaction } from '../types'

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

const ANALYSIS_PROMPT = `You are analyzing a Barclays Arrival Mastercard credit card statement for a personal budgeting app.

Analyze every credit card charge and return compact JSON. Be terse — short descriptions are fine.

For each transaction:
1. Category — pick one: Groceries, Dining, Gas, Amazon - Household, Amazon - Discretionary, Streaming, Entertainment, Healthcare, Home & Garden, Shopping, Travel, Clothing, Personal Care, Insurance, Utilities, Other
2. isRecurring — true if same merchant appears monthly, subscription, insurance, or utility
3. Amazon only (description contains "AMAZON"): set isAmazon:true; if order history provided match by date (±5 days) and amount to get item name; amazonType "subscribe-save" for household consumables, "discretionary" for electronics/toys/games/books/gadgets
4. Skip payments TO Barclays and refund credits
5. Infer statement period from dates in the document

Return ONLY this JSON (no markdown, no explanation). Omit optional fields when null/false to save space:
{
  "id": "2026-04",
  "month": "April 2026",
  "statementRange": "Apr 1 – Apr 30",
  "notes": "2-3 sentence summary",
  "transactions": [
    {"id":"tx1","date":"2026-04-15","description":"NETFLIX","amount":15.99,"category":"Streaming","isRecurring":true},
    {"id":"tx2","date":"2026-04-15","description":"AMAZON.COM*AB1","amount":47.83,"category":"Amazon - Household","isRecurring":true,"isAmazon":true,"amazonType":"subscribe-save","amazonItemDescription":"Tide Pods"},
    {"id":"tx3","date":"2026-04-20","description":"WALMART","amount":93.42,"category":"Groceries","isRecurring":false}
  ],
  "reductionSuggestions": [
    {"id":"sug1","description":"Specific actionable tip","potentialSavings":25,"dismissed":false}
  ]
}

Rules:
- amount always positive
- omit isAmazon, amazonType, amazonItemDescription when not an Amazon charge
- transaction ids: tx1, tx2, ...  suggestion ids: sug1, sug2, ...
- potentialSavings: number or null
- 3-5 suggestions based on what you actually see`

export async function analyzeCreditCard(
  statement: StatementFile,
  amazonCsvContent: string | null,
  apiKey: string,
): Promise<CCMonthlyAnalysis> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const amazonSection = amazonCsvContent
    ? `\n\nAmazon Order History CSV:\n\`\`\`\n${amazonCsvContent}\n\`\`\``
    : ''

  const userContent: Anthropic.MessageParam['content'] =
    statement.type === 'pdf'
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: statement.base64 } },
          { type: 'text', text: ANALYSIS_PROMPT + amazonSection },
        ]
      : ANALYSIS_PROMPT +
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
  }))

  return {
    id: parsed.id,
    month: parsed.month,
    statementRange: parsed.statementRange,
    savedAt: new Date().toISOString().split('T')[0],
    notes: parsed.notes,
    transactions,
    reductionSuggestions: parsed.reductionSuggestions,
  }
}

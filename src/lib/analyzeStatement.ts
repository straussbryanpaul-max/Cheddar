import Anthropic from '@anthropic-ai/sdk'
import type { Bill } from '../types'

export interface CategorizedTransaction {
  date: string
  description: string
  amount: number
  category: string
  billId: string | null
  isRecurring: boolean
}

export interface CategorySummary {
  category: string
  billId: string | null
  billName: string
  budgeted: number
  actual: number
  delta: number
}

export interface BudgetSuggestion {
  billId: string
  billName: string
  currentAmount: number
  suggestedAmount: number
  reason: string
}

export interface StatementAnalysis {
  periodLabel: string
  transactions: CategorizedTransaction[]
  summary: CategorySummary[]
  suggestions: BudgetSuggestion[]
  uncategorized: CategorizedTransaction[]
  notes: string
}

export async function analyzeStatement(
  csvContent: string,
  bills: Bill[],
  startDate: string,
  endDate: string,
  apiKey: string,
): Promise<StatementAnalysis> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const billsJson = JSON.stringify(
    bills.filter(b => b.active).map(b => ({
      id: b.id,
      name: b.name,
      amount: b.amount,
      category: b.category,
    })),
    null,
    2
  )

  const prompt = `You are analyzing a bank statement CSV for a personal budgeting app called Cheddar.

The user's pay period runs from ${startDate} to ${endDate}.

Here are the user's budget categories and bills:
${billsJson}

Here is the bank statement CSV:
\`\`\`
${csvContent}
\`\`\`

Analyze the transactions and return a JSON object with exactly this shape:
{
  "periodLabel": "May 1 - May 14",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "original description from CSV",
      "amount": 123.45,
      "category": "Groceries",
      "billId": "b10",
      "isRecurring": true
    }
  ],
  "summary": [
    {
      "category": "Groceries",
      "billId": "b10",
      "billName": "Groceries",
      "budgeted": 150,
      "actual": 187,
      "delta": -37
    }
  ],
  "suggestions": [
    {
      "billId": "b10",
      "billName": "Groceries",
      "currentAmount": 150,
      "suggestedAmount": 190,
      "reason": "Actual spending averaged $187 over this period"
    }
  ],
  "uncategorized": [
    {
      "date": "YYYY-MM-DD",
      "description": "SOME MYSTERY MERCHANT",
      "amount": 34.50,
      "category": "Unknown",
      "billId": null,
      "isRecurring": false
    }
  ],
  "notes": "Brief human-readable summary of findings"
}

Rules:
- Match transactions to bills by best semantic guess (e.g. "KROGER" → Groceries bill)
- Use negative amounts for debits/spending (money out)
- Use positive amounts for credits (pay deposits, refunds)
- Skip the paycheck deposit itself in the transactions array — only include spending
- "delta" in summary = budgeted - actual (negative means over budget)
- Only include bills in summary if there were actual transactions for that category
- Only suggest adjustments for categories that show consistent over/under spending
- billId must be one of the IDs from the bills list, or null for uncategorized
- isRecurring: true for bills, subscriptions, utilities, and any regular monthly charge; false for one-time or discretionary purchases
- Return ONLY valid JSON, no markdown, no explanation`

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const raw = textBlock.text.trim()
  // Strip markdown code fences if model wrapped it anyway
  const json = raw.startsWith('```') ? raw.replace(/^```[^\n]*\n/, '').replace(/```$/, '').trim() : raw

  return JSON.parse(json) as StatementAnalysis
}

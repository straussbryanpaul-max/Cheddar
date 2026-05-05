import Anthropic from '@anthropic-ai/sdk'
import type { CCMonthlyAnalysis } from '../types'

export async function analyzeCreditCard(
  ccCsvContent: string,
  amazonCsvContent: string | null,
  apiKey: string,
): Promise<CCMonthlyAnalysis> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const amazonSection = amazonCsvContent
    ? `\n\nAmazon Order History CSV (use this to identify what each Amazon charge actually was):\n\`\`\`\n${amazonCsvContent}\n\`\`\``
    : '\n\n(No Amazon order history provided. For Amazon transactions set amazonType to null unless the merchant description makes it obvious.)'

  const prompt = `You are analyzing a Barclays Arrival Mastercard credit card statement for a personal budgeting app called Cheddar.

Barclays CC statement CSV:
\`\`\`
${ccCsvContent}
\`\`\`
${amazonSection}

Analyze every credit card charge and return a JSON analysis.

For each transaction:
1. Pick the best category from exactly this list: Groceries, Dining, Gas, Amazon - Household, Amazon - Discretionary, Streaming, Entertainment, Healthcare, Home & Garden, Shopping, Travel, Clothing, Personal Care, Insurance, Utilities, Other
2. Decide if it is RECURRING (same merchant monthly, subscriptions, insurance, utilities) or a one-off
3. For Amazon transactions (description contains "AMAZON"):
   - isAmazon: true
   - If order history is provided: match by date (±5 days) and amount to find the item description
   - amazonType "subscribe-save": household consumables — soap, paper products, cleaning supplies, vitamins, food staples, pet food, personal care refills
   - amazonType "discretionary": electronics, toys, games, books, clothing, gadgets, tools, novelty items
   - amazonType null: uncertain, or no order history provided
4. Skip payment/credit transactions (money paid TO Barclays, refunds credited back)

Return ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "id": "2026-04",
  "month": "April 2026",
  "statementRange": "Apr 1 – Apr 30",
  "notes": "2-3 sentence summary of spending patterns and notable observations",
  "transactions": [
    {
      "id": "tx1",
      "date": "2026-04-15",
      "description": "AMAZON.COM*MK9LX",
      "amount": 47.83,
      "barclaysCategory": "Shopping",
      "aiCategory": "Amazon - Household",
      "category": "Amazon - Household",
      "aiIsRecurring": true,
      "isRecurring": true,
      "isAmazon": true,
      "amazonType": "subscribe-save",
      "amazonItemDescription": "Tide Pods 81ct"
    }
  ],
  "reductionSuggestions": [
    {
      "id": "sug1",
      "description": "Specific actionable observation about where money could be saved",
      "potentialSavings": 25,
      "dismissed": false
    }
  ]
}

Rules:
- amount is always positive (what was charged to the card)
- transaction ids: "tx1", "tx2", etc.
- suggestion ids: "sug1", "sug2", etc.
- aiCategory and category start identical; same for aiIsRecurring and isRecurring
- potentialSavings: estimated monthly $ savings or null
- Generate 3-5 specific suggestions based on what you actually observe in the data`

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const raw = textBlock.text.trim()
  const json = raw.startsWith('```') ? raw.replace(/^```[^\n]*\n/, '').replace(/```$/, '').trim() : raw
  const parsed = JSON.parse(json) as CCMonthlyAnalysis
  parsed.savedAt = new Date().toISOString().split('T')[0]
  return parsed
}

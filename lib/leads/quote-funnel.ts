export interface QuoteOutcomeEvent {
  companyId: string;
  outcomeCode: string;
}

export function computeQuoteFunnel(events:QuoteOutcomeEvent[]){
  const companiesByOutcome=new Map<string,Set<string>>();
  for(const event of events){
    if(!companiesByOutcome.has(event.outcomeCode))companiesByOutcome.set(event.outcomeCode,new Set());
    companiesByOutcome.get(event.outcomeCode)!.add(event.companyId);
  }
  const requested=companiesByOutcome.get("quote_requested")||new Set<string>();
  const sent=companiesByOutcome.get("quote_sent")||new Set<string>();
  const won=companiesByOutcome.get("won")||new Set<string>();
  const lost=companiesByOutcome.get("lost")||new Set<string>();
  const terminal=new Set([...won,...lost]);
  const requestedAndSent=[...requested].filter(id=>sent.has(id)).length;
  const sentAndWon=[...sent].filter(id=>won.has(id)).length;
  const awaitingQuote=[...requested].filter(id=>!sent.has(id)&&!terminal.has(id)).length;
  const openQuotes=[...sent].filter(id=>!terminal.has(id)).length;
  return {
    quoteRequested:requested.size,
    quoteSent:sent.size,
    awaitingQuote,
    openQuotes,
    won:won.size,
    lost:lost.size,
    requestToQuoteRate:requested.size?Math.round(requestedAndSent/requested.size*100):0,
    quoteWinRate:sent.size?Math.round(sentAndWon/sent.size*100):0,
  };
}

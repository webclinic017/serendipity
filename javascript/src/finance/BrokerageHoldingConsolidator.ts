import { BrokerageHolding, Statement } from "../gen/finance"
import * as csvwriter from 'csv-writer';
import { format as formatDate } from 'date-fns';

export class BrokerageHoldingConsolidator
{
    private allHoldings: { 
        holding: BrokerageHolding, 
        statement: Statement 
    }[];

    constructor()
    {
        this.allHoldings = [];
    }

    private dateTimeInt(h: BrokerageHolding, key:keyof(BrokerageHolding))
    {
        if (h[key] != undefined) {
            return (h[key] as Date).getTime();
        }
        return 0;
    }

    public addStatement(statement: Statement)
    {
        if (!statement.brokerageHoldings)
            return;
        
        statement.brokerageHoldings.forEach(h => {
            this.allHoldings.push({ holding: h, statement: statement });
        });

        this.allHoldings.sort((c, d) => {
            let a = c.holding;
            let b = d.holding;
            if (a.symbol == b.symbol) {
                return this.dateTimeInt(a, "purchaseDate") - this.dateTimeInt(b, "purchaseDate");
            }
            return a.symbol < b.symbol ? -1 : 1;
        });
    } 

    public addStatements(statements: Statement[])
    {
        statements.forEach(e => this.addStatement(e));
    }

    public async writeToCsvFile(output: string)
    {
        let writer = csvwriter.createObjectCsvWriter({
                path: output, 
                header: [
                    { id: 'symbol', title: 'Symbol' },
                    { id: 'account', title: 'Account' },
                    { id: 'institution', title: 'Institution' },
                    { id: 'costBasis', title: 'Cost Basis' },
                    { id: 'purchaseDate', title: 'Purchase Date' },
                    { id: 'quantity', title: 'Quantity' },
                    { id: 'value', title: 'Value' }
                ],
                alwaysQuote: true,
                // Some CSV importers requires records to be delimited by CRLF
                recordDelimiter: "\r\n"
        });

        let flattened = this.allHoldings.map(e => {
            let holding = e.holding;
            let stmnt = e.statement;
            return {
                'symbol': holding.symbol,
                'costBasis': 'costBasis' in holding ? holding.costBasis.value : "",
                'purchaseDate': formatDate(holding.purchaseDate != undefined ? holding.purchaseDate : Date.now(), "yyyy/MM/dd"),
                'quantity': holding.quantity.toString(),
                'value': holding.value.end.value,
                'account': stmnt.accountNumber,
                'institution': stmnt.institutionName
            };
        });

        await writer.writeRecords(flattened);
    }
}

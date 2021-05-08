import * as FinanceModels from '../gen/finance'
import * as csvwriter from 'csv-writer';
import { format as formatDate } from 'date-fns';

export namespace TillerMoney
{
    export interface Entry
    {
        date: string,
        description: string,
        fullDescription: string,
        accountDescription: string,
        institutionName: string,
        checkNumber: string,
        amount: string,
        accountNumber: string,
        month: string,
        week: string,
        category: string,
        statement: string
    }

    const dateFormat:string = "MM/dd/yyyy";

    function bankTransactionsToEntries(
        statement: FinanceModels.Statement, 
        bankTransactions: FinanceModels.BankTransaction[],
        entries: Entry[])
    {
        bankTransactions.forEach(t => {
            entries.push({
                date: formatDate(t.postedDate, dateFormat),
                description: t.description,
                fullDescription: t.memo,
                accountNumber: statement.accountNumber.substr(-4).padStart(8, "x"),
                institutionName: statement.institutionName,
                month: formatDate(new Date(t.postedDate.getFullYear(), t.postedDate.getMonth(), 1), dateFormat),
                week: formatDate(new Date(t.postedDate.getTime() - t.postedDate.getDay() * 24 * 60 * 60 * 1000), dateFormat),
                amount: t.amount.value.toString(),
                category: "",
                accountDescription: "",
                checkNumber: "",
                statement: ""
            })
        });
    }

    function brokerageTransactionToEntries(
        statement: FinanceModels.Statement,
        brokerageTransactions: FinanceModels.BrokerageTransaction[],
        entries: Entry[])
    {
        brokerageTransactions.forEach(t => {
            entries.push({
                date: formatDate(t.tradeDate, dateFormat),
                description: `${t.transactionType} ${t.symbol}`,
                fullDescription: t.description,
                accountNumber: statement.accountNumber.substr(-4).padStart(8, "x"),
                institutionName: statement.institutionName,
                month: formatDate(new Date(t.tradeDate.getFullYear(), t.tradeDate.getMonth(), 1), dateFormat),
                week: formatDate(new Date(t.tradeDate.getTime() - t.tradeDate.getDay() * 24 * 60 * 60 * 1000), dateFormat),
                amount: t.amount.value.toString(),
                category: "",
                accountDescription: "",
                checkNumber: "",
                statement: ""
            })
        });
    }

    function statementsToEntries(statements: FinanceModels.Statement[])
    {
        let ret: Entry[] = []
        statements.forEach(statement => {
            if ('creditCardTransactions' in statement) {
                bankTransactionsToEntries(statement, statement.creditCardTransactions, ret);
            }
            if ('bankTransactions' in statement) {
                bankTransactionsToEntries(statement, statement.bankTransactions, ret);
            }
            if ('brokerageTransactions' in statement) {
                brokerageTransactionToEntries(statement, statement.brokerageTransactions, ret);
            }
        });

        return ret;
    }

    export async function writeCsvOutput(statements: FinanceModels.Statement[], output: string)
    {
        let entries = statementsToEntries(statements);
        let writer = csvwriter.createObjectCsvWriter({
                path: output, 
                header: [
                    { id: 'date', title: 'Date' },
                    { id: 'description', title: 'Description' },
                    { id: 'category', title: 'Category' },
                    { id: 'amount', title: 'Amount' },
                    { id: 'accountDescription', title: 'Account' },
                    { id: 'statement', title: 'Statement'},
                    { id: 'accountNumber', title: "Account #" },
                    { id: 'institutionName', title: "Institution" },
                    { id: 'month', title: "Month" },
                    { id: 'week', title: "Week" },
                    { id: 'checkNumber', title: "Check Number" },
                    { id: 'fullDescription', title: "Full Description" }
                ]
        });
        await writer.writeRecords(entries);
    }
}
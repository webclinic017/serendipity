import { BankTransactionTransactionTypeEnum } from "../../gen/finance/models";
import { MerrillEdge, MerrillEdgeCsvExtractor, InteractiveBrokersCsvExtractor, FidelityCsvExtractor, Fidelity } from "../";
import { expect } from 'chai';
import 'mocha';
import * as fs from 'fs';
import * as path from 'path';
import { OfxStatementExtractor } from "../Ofx";
import { StatementExtractorFactory } from "../StatementExtractorFactory";

function testFile(fname: string): string
{
    return path.join(process.env["TEST_DATA_DIR"], "finance", fname);
}

describe("Merrill Edge Tests", () => {
    it('Test parsing unrealized lots csv', () => {
        let extractor = new MerrillEdgeCsvExtractor();
        let csvData = fs.readFileSync(testFile('merrill_edge_holdings_export_all_accounts.csv')).toString();
        expect(extractor.canProcess(csvData)).to.be.true;
        let statements = extractor.process(csvData);
        expect(statements.length).to.equal(2);
    
        let statement = statements[0];
        expect(statement.accountNumber).to.equal("11A-11B11");
        expect(statement.startDate).to.equal(statement.endDate);
        expect(statement.startDate.toString()).to.equal((new Date(2020, 10, 20)).toString());
        let holdings = statement.brokerageHoldings;
        expect(holdings.length).to.equal(2);
        let holding = holdings[0];
        expect(holding.symbol).to.equal("XXXX230120C00045000");
        expect(holding.costBasis.value).to.equal(1111.11);
        expect(holding.costBasis.currencyCode).to.equal("USD");
        expect(holding.purchaseDate.toString()).to.equal((new Date(2020, 9, 19)).toString());
        expect(holding.value.start.value).to.equal(1110.12);
        expect(holding.value.start.currencyCode).to.equal("USD");
        expect(holding.quantity).to.equal(2);
    
        holding = holdings[1];
        expect(holding.symbol).to.equal("YYY");
    });

    it ("Test symbol to OCC code", ()=> {
        expect(MerrillEdge.symbolToOccCode("XXXX#A2023D450000")).to.equal("XXXX230120C00045000");
        expect(MerrillEdge.symbolToOccCode("XXXX#A2023C130000")).to.equal("XXXX230120C00130000");
    });
});

describe("Interactive Brokers Tests", () => {
    it("Test parsing advisor csv", () => {
        let extractor = new InteractiveBrokersCsvExtractor();
        let csvData = fs.readFileSync(testFile('interactive_brokers_multi_account_flex_query_export.csv')).toString();
        expect(extractor.canProcess(csvData)).to.be.true;

        let statements = extractor.process(csvData);
        expect(statements.length).to.equal(4);

        let statement = statements[0];

        expect(statement.accountNumber).to.equal("U0000001");
        expect(statement.startDate.toString()).to.equal(new Date(2020, 0, 2).toString());
        expect(statement.endDate.toString()).to.equal(new Date(2020, 11, 18).toString());
        
        let holdings = statement.brokerageHoldings;
        expect(holdings.length).to.equal(1);
        let holding = holdings[0];
        expect(holding.symbol).to.equal("BBBB");
        expect(holding.costBasis.value).to.equal(2920.6);
        expect(holding.costBasis.currencyCode).to.equal("USD");
        expect(holding.quantity).to.equal(12);

        let bankTrans = statement.bankTransactions;
        expect(bankTrans.length).to.equal(3);
        let bt = bankTrans[0];
        expect(bt.amount.currencyCode).to.equal("USD");
        expect(bt.amount.value).to.equal(-1.06);
        expect(bt.postedDate.toString()).to.equal(new Date(2020, 0, 3, 18, 0, 45).toString());
        expect(bt.description).to.equal("BALANCE OF MONTHLY MINIMUM FEE FOR DEC 2019");
        expect(bt.category).to.equal("Other Fees");

    });

    it("Test parsing trading confirmation", () => {
        let extractor = new InteractiveBrokersCsvExtractor();
        let csvData = fs.readFileSync(testFile('interactive_brokers_multi_account_flex_query_trade_conformation_export.csv')).toString();
        expect(extractor.canProcess(csvData)).to.be.true;

        let statements = extractor.process(csvData);
        expect(statements.length).to.equal(1);

        let statement = statements[0];
        expect(statement.accountNumber).to.equal("U0000001");
        expect(statement.startDate.toString()).to.equal(new Date(2020, 11, 28).toString());
        expect(statement.endDate.toString()).to.equal(new Date(2020, 11, 28).toString());
        let trans = statement.brokerageTransactions;
        expect(trans.length).to.equal(5);
        let tran = trans[0];
        expect(tran.symbol).to.equal("XXXX201231C03180000");
        expect(tran.amount.value).to.equal(-3000);
        expect(tran.amount.currencyCode).to.equal("USD");
        expect(tran.quantity).to.equal(1);
        expect(tran.commission.value).to.equal(-1.0738);
        expect(tran.commission.currencyCode).to.equal("USD");
        expect(tran.tradeDate.toString()).to.equal(new Date(2020, 11, 28, 10, 5, 59).toString());
        expect(tran.settlementDate.toString()).to.equal(new Date(2020, 11, 29).toString());

        tran = trans[4];
        expect(tran.symbol).to.equal("XXXX201231C03180000");
        expect(tran.amount.value).to.equal(21840);
        expect(tran.amount.currencyCode).to.equal("USD");
        expect(tran.quantity).to.equal(-8);
        expect(tran.commission.value).to.equal(-2.929064);
        expect(tran.commission.currencyCode).to.equal("USD");
        expect(tran.tradeDate.toString()).to.equal(new Date(2020, 11, 28, 10, 14, 20).toString());
        expect(tran.settlementDate.toString()).to.equal(new Date(2020, 11, 29).toString());
    });
});

describe("Fidelity Tests", () => {
    it("Test parsing holdings csv", () => {
        let extractor = new FidelityCsvExtractor();
        let csvData = fs.readFileSync(testFile('fidelity_open_positions.csv')).toString();
        expect(extractor.canProcess(csvData)).to.be.true;

        let statements = extractor.process(csvData);
        expect(statements.length).to.equal(1);

        let statement = statements[0];
        expect(statement.accountNumber).to.equal("Z00000001");
        expect(statement.startDate.toString()).to.equal(new Date(2020, 11, 21).toString());
        expect(statement.endDate.toString()).to.equal(new Date(2020, 11, 21).toString());
        let holdings = statement.brokerageHoldings;
        expect(holdings.length).to.equal(2);
        let holding = holdings[0];
        expect(holding.symbol).to.equal("Y");
        expect(holding.costBasis.value).to.equal(2809.90);
        expect(holding.costBasis.currencyCode).to.equal("USD");
        expect(holding.quantity).to.equal(100);
    });


    it ("Test symbol to OCC code", ()=> {
        expect(Fidelity.toOccCode("XXXX", "")).to.equal("XXXX");
        expect(Fidelity.toOccCode("-XXXX230120C150", "XXXX JAN 20 2023 $150 CALL")).to.equal("XXXX230120C00150000");
    });
});

describe("QFX Tests", () => {
    it("Test Parsing Capital One Credit Card QFX", ()=> {
        let extractor = new OfxStatementExtractor();
        let data = fs.readFileSync(testFile('capital_one_credit_card_transactions.qfx')).toString();
        let statements = extractor.process(data);
        expect(statements.length).to.equal(1);
        let statement = statements[0];
        expect(statement.institutionName).to.equal("Capital One");
        expect(statement.accountNumber).to.equal("1111");
        expect(statement.startDate.toString()).to.equal(new Date(2015, 0, 1).toString());
        expect(statement.endDate.toString()).to.equal(new Date(2015, 11, 26).toString());
        let trans = statement.creditCardTransactions[0];
        expect(trans.amount.currencyCode).to.equal("USD");
        expect(trans.amount.value).to.equal(-107.74);
        expect(trans.transactionId).to.equal("201512211452341");
        expect(trans.transactionType).to.equal(BankTransactionTransactionTypeEnum.Debit);
        expect(trans.memo).to.be.undefined;
        expect(trans.description).to.equal("TEST TRANSACTION 1");
        expect(trans.postedDate.toString()).to.equal(new Date(2015, 11, 21).toString());
        expect(trans.transactionDate.toString()).to.equal(new Date(2015, 11, 20).toString());
    });

    it("Test Parsing Chase Business Checking QFX", ()=> {
        let extractor = new OfxStatementExtractor();
        let data = fs.readFileSync(testFile('chase_business_checking_transactions.qfx')).toString();
        let statements = extractor.process(data);
        expect(statements.length).to.equal(1);
        let statement = statements[0];
        expect(statement.institutionName).to.equal("Chase");
        expect(statement.accountNumber).to.equal("000000011");
        expect(statement.startDate.toString()).to.equal(new Date(2012, 7, 27, 12).toString());
        expect(statement.endDate.toString()).to.equal(new Date(2012, 11, 22, 12).toString());
        let trans = statement.bankTransactions[0];
        expect(trans.amount.currencyCode).to.equal("USD");
        expect(trans.amount.value).to.equal(1000.00);
        expect(trans.transactionId).to.equal("201212220");
        expect(trans.transactionType).to.equal(BankTransactionTransactionTypeEnum.Credit);
        expect(trans.memo).to.be.undefined;
        expect(trans.description).to.equal("TEST TRANSACTION 1");
        expect(trans.postedDate.toString()).to.equal(new Date(2012, 11, 22, 12).toString());
        expect(trans.transactionDate).to.be.undefined;
    });


    it("Test Parsing Wells Fargo Checking QFX", ()=> {
        let extractor = new OfxStatementExtractor();
        let data = fs.readFileSync(testFile('wells_fargo_checking_transactions.qfx')).toString();
        let statements = extractor.process(data);
        expect(statements.length).to.equal(1);
        let statement = statements[0];
        expect(statement.institutionName).to.equal("Wells Fargo");
        expect(statement.accountNumber).to.equal("000004444");
        expect(statement.startDate.toString()).to.equal(new Date(2012, 0, 1, 12).toString());
        expect(statement.endDate.toString()).to.equal(new Date(2012, 11, 9, 12).toString());
        let trans = statement.bankTransactions[0];
        expect(trans.amount.currencyCode).to.equal("USD");
        expect(trans.amount.value).to.equal(-121.95);
        expect(trans.transactionId).to.equal("201201061");
        expect(trans.transactionType).to.equal(BankTransactionTransactionTypeEnum.Debit);
        expect(trans.memo).to.be.undefined;
        expect(trans.description).to.equal("TEST NAME 1 TEST MEMO 1");
        expect(trans.postedDate.toString()).to.equal(new Date(2012, 0, 6, 12).toString());
        expect(trans.transactionDate).to.be.undefined;
    });

    it("Test Parsing Merrill Edge Brokerage OFX", () => {
        let extractor = new OfxStatementExtractor();
        let data = fs.readFileSync(testFile('merrill_edge_activity_export_all_accounts.qfx')).toString();
        let statements = extractor.process(data);
        expect(statements.length).to.equal(2);

        {
            let statement = statements[0];
            expect(statement.accountNumber).to.equal("00000003");
            {
                let trans = statement.brokerageTransactions;
                expect(trans.length).to.equal(4);

                let tran = trans[0];
                expect(tran.tradeDate.toString()).to.equal(new Date(2020, 0, 3, 11).toString());
                expect(tran.settlementDate.toString()).to.equal(new Date(2020, 0, 6, 11).toString());
                expect(tran.symbol).to.equal(MerrillEdge.symbolToOccCode("XXXX#M1720C450000"));
                expect(tran.price.value).to.equal(17.74);
                expect(tran.commission.value).to.equal(0.65);
                expect(tran.amount.value).to.equal(-1774.65);
            }
            {
                let trans = statement.bankTransactions;
                expect(trans.length).to.equal(1);
                let t = trans[0];
                expect(t.amount).to.eql({ value: 0.01, currencyCode: "USD" });
                expect(t.transactionType).to.equal(BankTransactionTransactionTypeEnum.Credit);
                expect(t.postedDate).to.eql(new Date(2020, 0, 31, 11));
                expect(t.description).to.equal("Bank Interest: ML DIRECT DEPOSIT PROGRM FROM 01/01 THRU 01/30");
            }
        }

        {
            let statement = statements[1];
            expect(statement.accountNumber).to.equal("00000004");
            let trans = statement.bankTransactions;
            expect(trans.length).to.equal(1);
        }
    });
});

describe("Statement Extractor Factory tests", () => {
    it("Test all files", () => {
        const allTestFiles = [
            testFile('merrill_edge_holdings_export_all_accounts.csv'),
            testFile('interactive_brokers_multi_account_flex_query_export.csv'),
            testFile('interactive_brokers_multi_account_flex_query_trade_conformation_export.csv'),
            testFile('fidelity_open_positions.csv'),
            testFile('capital_one_credit_card_transactions.qfx'),
            testFile('chase_business_checking_transactions.qfx')
        ]
        allTestFiles.forEach(f => {
            let statements = StatementExtractorFactory.processStatement(f);
            expect(statements.length).to.be.greaterThan(0);
        });
    });
});
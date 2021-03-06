import * as yargs from 'yargs';
import * as Finance from '../finance';
import * as fs from 'fs';
import * as csvwriter from 'csv-writer';
import { BrokerageHoldingConsolidator, InteractiveBrokers, StatementExtractorFactory } from '../finance';
import { BrokerageTransactionTransactionTypeEnum, PriorMtmPosition, Statement } from '../gen/finance';
import { format as formatDate } from 'date-fns';
import { DefaultObject } from '../utils';

let args = yargs.scriptName("serendipity-cli")
    .command(
    {
        command: "export-to-tiller-money",
        describe: "Export statement to Tiller Money", 
        builder: (args: yargs.Argv) => {
            return yargs.option('input', {
                describe: "The path of the statement to export",
                demandOption: true,
                array: true
            })
            .alias({"i": "input"})
            .option('output', {
                describe: "The path to the csv to export",
                demandOption: true
            })
            .alias({"o": "output"})
        },
        handler: (args: yargs.Arguments) => {
            let statements: Statement[] = [];
            (args["input"] as string[]).forEach(f => {
                statements.push(...StatementExtractorFactory.processStatement(f));
            })
            Finance.TillerMoney.writeCsvOutput(
                statements,
                args["output"] as string
            );
        }
    })
    .command(
        {
            command: "consolidate-holdings",
            describe: "Consolidate and output holdings as a single csv",
            builder: (args: yargs.Argv) => {
                return yargs.option('inputs', {
                    describe: "Input CSVs",
                    demandOption: true,
                    array: true
                })
                .alias({"i": "inputs"})
                .option('output', {
                    describe: "The path to the csv to export",
                    demandOption: true
                })
                .alias({"o": "output"})
            },
            handler: (args: yargs.Arguments) => {
                let c = new BrokerageHoldingConsolidator();
                (args["inputs"] as Array<string>).forEach(e => {
                    c.addStatements(StatementExtractorFactory.processStatement(e));
                });
                c.writeToCsvFile(args["output"] as string);
            }
        }
    )
    .command(
        {
            command: "run-ib-flex-query",
            describe: "Run an interactive brokers flex query",
            builder: (args: yargs.Argv) => {
                return yargs.option('query', {
                    describe: "The query id",
                    demandOption: true
                })
                .alias({"q": "query"})
                .option('token', {
                    describe: "The token",
                    demandOption: true
                })
                .alias({"t": "token"})
                .option('output', {
                    describe: "The path to write the output",
                    demandOption: true
                })
                .alias({"o": "output"})
            },
            handler: async (args: yargs.Arguments) => {
                fs.writeFileSync(
                    args["output"] as string,
                    await InteractiveBrokers.runFlexQuery(args["token"] as string, args["query"] as string)
                );
            }
        }
    )
    .command(
        {
            command: "report-monthly-realized-income",
            describe: "Report realized income per month", 
            builder: (args: yargs.Argv) => {
                return yargs.option('inputs', {
                    describe: "Input CSVs",
                    demandOption: true,
                    array: true
                })
                .alias({"i": "inputs"})
                .option('output', {
                    describe: "The path to the csv to export",
                    demandOption: true
                })
                .alias({"o": "output"})
            },
            handler: (args: yargs.Arguments) => {
                let gainsByMonth: { [month:string]: number} = {};

                let updateGain = (date:Date, amount:number) => {
                    let dateStr = formatDate(date, "yyyy/MM");
                    if (dateStr in gainsByMonth) {
                        gainsByMonth[dateStr] += amount;
                    }
                    else {
                        gainsByMonth[dateStr] = amount;
                    }
                }

                (args["inputs"] as Array<string>).forEach(f => {
                    StatementExtractorFactory.processStatement(f).forEach(s => {
        
                        let gainsBySymbol: { [symbol:string]: number } = {}
                        let updateGainSymbol = (symbol:string, amount:number) => {
                            if (symbol in gainsBySymbol) {
                                gainsBySymbol[symbol] += amount;
                            }
                            else {
                                gainsBySymbol[symbol] = amount;
                            }
                        }
        
                        let hasMtm:boolean = false;
                        let hasRealized:boolean = false;
                        s.brokerageTransactions.forEach(l => {
                            if (l.transactionType == BrokerageTransactionTransactionTypeEnum.Dividend 
                                || l.transactionType == BrokerageTransactionTransactionTypeEnum.Interest
                                || l.transactionType == BrokerageTransactionTransactionTypeEnum.Fee) {
                                updateGain(l.settlementDate, l.amount.value);
                            }
                            else if (l.transactionType == BrokerageTransactionTransactionTypeEnum.Sale 
                                || l.transactionType == BrokerageTransactionTransactionTypeEnum.Purchase) {
                                if (l.mtmPnl != null) {
                                    hasMtm = true;
                                    updateGain(l.tradeDate, l.mtmPnl.value + l.commission.value);
                                }
                                else if (l.realizedPnl != null) {
                                    hasRealized = true;
                                    updateGain(l.tradeDate, l.realizedPnl.value);
                                }
                            }
                        });

                        if (hasMtm && s.priorMtmPositions != null) {
                            s.priorMtmPositions.forEach(l => {
                                updateGain(l.date, l.pnl.value);
                            });
                        }

                        if (!hasMtm && !hasRealized) {
                            s.brokerageRealizedLots.forEach(l => {
                                    updateGain(l.liquidationDate, l.liquidationAmount.value - l.acquisitionAmount.value);
                                }
                            );
                        }

                        Object.keys(gainsBySymbol).sort().forEach(k => {
                            console.log(`${k} ${gainsBySymbol[k]}`);
                        })    
                    });

                });

                let entries:DefaultObject[] = [];
                Object.keys(gainsByMonth).sort().forEach(k => {
                    entries.push({
                        'date': k,
                        'amount': gainsByMonth[k].toString()
                    })
                });
                
                let writer = csvwriter.createObjectCsvWriter({
                    path: args["output"] as string,
                    header: [
                        { id: 'date', title: 'Date' },
                        { id: 'amount', title: 'Gains' }
                    ]
                });
                writer.writeRecords(entries);
            }
        }
    )
    .help()
    .strict(true)
    .showHelpOnFail(true)
    .demandCommand()
    .argv;

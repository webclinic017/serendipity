from datetime import datetime
import math
import pandas
import re
from typing import Dict, List

from ...extractor import Document
from ...gen.finance.models import AssetValue, BrokerageHolding, BrokerageTransaction, Statement

from .statement_extractor import CsvStatementExtractor 

class MerrillEdge:
    institutionName="Merrill Edge"

    _nonOccOptionRegex:re.Match = re.compile("([a-zA-Z]+)#([a-zA-Z])([0-9]{2})([0-9]{2})([a-zA-Z])([0-9]+)")

    @classmethod
    def symbolToOccCode(cls, symbol:str):
        m = cls._nonOccOptionRegex.search(symbol)
        if m is None:
            return symbol
        sec = m.group(1)
        month = m.group(2)
        day = m.group(3)
        year = m.group(4)
        ndivide = ord(m.group(5)[0]) - ord('A') + 1
        price = round(int(m.group(6)) / math.pow(10, ndivide)) * 1000
        month = ord(month[0]) - ord('A') + 1
        call: str = 'C'
        if month > 12:
            month = month  - 12
            call = 'P'
        return f"{sec}{year}{month:02}{day}{call}{price:08}"


class MerrillEdgeCsvHoldingsExtractor(CsvStatementExtractor, institutionName=MerrillEdge.institutionName):
    def __init__(self, doc: Document):
        super().__init__(doc)

    def holdingForRow(self, row: pandas.Series):
        return BrokerageHolding(
            cost_basis="$" + row["Cost Basis ($)"],
            purchase_date=datetime.strptime(row["Acquisition Date"], "%m/%d/%Y").isoformat(),
            quantity=row["Quantity"],
            symbol=MerrillEdge.symbolToOccCode(row["Symbol"].strip()),
            value=AssetValue(start="$" + row["Value ($)"], end="$" + row["Value ($)"])
        )

    def statementForRow(self, row: pandas.Series):
        return Statement(account_number=row["Account #"], 
            start_date=datetime.strptime(row["COB Date"].strip(), "%m/%d/%Y").isoformat(),
            end_date=datetime.strptime(row["COB Date"].strip(), "%m/%d/%Y").isoformat(),
            institution_name=MerrillEdge.institutionName,
            brokerage_holdings=[]
        )
    
    def statements(self) -> List[Statement]:
        d:Dict[str,Statement] = {}
        table = self._doc.extractSingleTable()
        for index,row in table.iterrows():
            accoutNumber = row["Account #"] 
            if not accoutNumber in d:
                d[accoutNumber] = self.statementForRow(row)
            d[accoutNumber].brokerage_holdings.append(self.holdingForRow(row))
        return list(d.values())

    @classmethod
    def canProcess(cls, document: Document) -> bool:
        if not document.isCsv:
            return False

        text:str = document.text()
        table = document.extractSingleTable()
        return (text.find(MerrillEdge.institutionName) >= 0 or text.find("Edge")) and ("Short/Long" in table.columns)

class MerrillEdgeCsvTransactionsExtractor(CsvStatementExtractor, institutionName=MerrillEdge.institutionName):
    transactionMap = {
        "Purchase" : "purchase",
        "Sale" : "sale",
        "Option Sale": "sale",
        "Option Purchase": "purchase",
        "Bank Interest": "interest",
        "Interest": "interest",
        "Deposit": "deposit",
        "Exchange": "exchange",
        "Option Assigned": "option_assigned",
        "Dividend": "dividend",
        "Withdrawal": "withdrawal",
        "Option Expired": "option_expired",
        "Transfer / Adjustment": "transfer",
        "Sale-Option Assigned": "sale"
    }
    
    def __init__(self, doc: Document):
        super().__init__(doc)


    def transactionForRow(self, row: pandas.Series):
        return BrokerageTransaction(
            trade_date=datetime.strptime(row["Trade Date"].strip(), "%m/%d/%Y").isoformat(),
            settlement_date=datetime.strptime(row["Settlement Date"].strip(), "%m/%d/%Y").isoformat(),
            status=("settled" if row["Pending/Settled"] == "Settled" else "pending"),
            transaction_type=self.transactionMap[row["Description 1 "].strip()],
            quantity=row["Quantity"],
            price="$" + row["Price ($)"],
            amount="$" + row["Amount ($)"],
            symbol=MerrillEdge.symbolToOccCode(row["Symbol/CUSIP #"].strip())
        )

    def statementForRow(self, row: pandas.Series):
        d = datetime.strptime(row["Trade Date"].strip(), "%m/%d/%Y").isoformat()
        return Statement(account_number=row["Account #"], 
            start_date=d,
            end_date=d,
            institution_name=MerrillEdge.institutionName,
            brokerage_transactions=[]
        )

    def updateDates(self, s:Statement, t:BrokerageTransaction):
        s.start_date = min(s.start_date, t.trade_date)
        s.end_date = min(s.end_date, t.trade_date)
    
    def statements(self) -> List[Statement]:
        d:Dict[str,Statement] = {}
        table = self._doc.extractSingleTable()
        for index,row in table.iterrows():
            accoutNumber = row["Account #"] 
            if not accoutNumber in d:
                d[accoutNumber] = self.statementForRow(row)
            t = self.transactionForRow(row)
            s = d[accoutNumber]
            s.brokerage_transactions.append(t)
            self.updateDates(s, t)
        return list(d.values())

    @classmethod
    def canProcess(cls, document: Document) -> bool:
        if not document.isCsv:
            return False
        text:str = document.text()
        table = document.extractSingleTable()
        return (text.find(MerrillEdge.institutionName) >= 0 or text.find("Edge")) and ("Settlement Date" in table.columns)


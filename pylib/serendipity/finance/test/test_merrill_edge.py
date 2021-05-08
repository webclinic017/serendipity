from datetime import datetime
import os
import unittest

from ...finance.extractors import createCsvStatementExtractor, CsvStatementExtractor
from ...finance.extractors.merrill_edge_extractor import MerrillEdge
from ...gen.finance.models import Statement, BrokerageHolding, BrokerageTransaction

dataDir = os.path.join(os.path.dirname(__file__), "../../../../test_data/finance");

class TestMerrillEdge(unittest.TestCase):
    def setUp(self):
        pass

    def test_exported_holdings_single_account(self):
        path = os.path.join(dataDir, 'merrill_edge_holdings_export_single_account.csv')
        i = createCsvStatementExtractor(path)
        self.assertIsNotNone(i)
        statement = i.statement()
        self.assertEqual(statement.account_number, "11A-11B11")
        self.assertEqual(datetime.fromisoformat(statement.start_date), datetime(2020, 11, 20))
        self.assertEqual(datetime.fromisoformat(statement.end_date), datetime(2020, 11, 20))
        self.assertEqual(statement.institution_name, "Merrill Edge")
        
        holdings = statement.brokerage_holdings
        self.assertEqual(len(holdings), 9)

        h:BrokerageHolding = holdings[0]
        self.assertEqual(h.symbol, "T")
        self.assertEqual(h.quantity, '300')
        self.assertEqual(h.cost_basis, "$8,435.97")
        self.assertEqual(h.value.start, "$8,496.00")
        self.assertEqual(h.value.end, "$8,496.00")

    def test_exported_holdings_multiple_accounts(self):
        path = os.path.join(dataDir, 'merrill_edge_holdings_export_all_accounts.csv')
        i = createCsvStatementExtractor(path)
        self.assertIsNotNone(i)
        statements = i.statements()
        statement = statements[0]
        self.assertEqual(statement.account_number, "11A-11B11")
        self.assertEqual(datetime.fromisoformat(statement.start_date), datetime(2020, 11, 20))
        self.assertEqual(datetime.fromisoformat(statement.end_date), datetime(2020, 11, 20))
        self.assertEqual(statement.institution_name, "Merrill Edge")
        
        holdings = statement.brokerage_holdings
        self.assertEqual(len(holdings), 9)

        h:BrokerageHolding = holdings[0]
        self.assertEqual(h.symbol, "T")
        self.assertEqual(h.quantity, '300')
        self.assertEqual(h.cost_basis, "$8,435.97")
        self.assertEqual(h.value.start, "$8,496.00")
        self.assertEqual(h.value.end, "$8,496.00")

        statement = statements[1]
        self.assertEqual(statement.account_number, "22A-11B11")
        self.assertEqual(datetime.fromisoformat(statement.start_date), datetime(2020, 11, 20))
        self.assertEqual(datetime.fromisoformat(statement.end_date), datetime(2020, 11, 20))
        self.assertEqual(statement.institution_name, "Merrill Edge")
        
        holdings = statement.brokerage_holdings
        self.assertEqual(len(holdings), 6)

        h:BrokerageHolding = holdings[0]
        self.assertEqual(h.symbol, "T")
        self.assertEqual(h.quantity, '165')
        self.assertEqual(h.cost_basis, "$5,011.05")
        self.assertEqual(h.value.start, "$4,672.80")
        self.assertEqual(h.value.end, "$4,672.80")

    def test_exported_settlements_multiple_accounts(self):
        path = os.path.join(dataDir, 'merrill_edge_brokerage_transactions_export_all_accounts.csv')
        i = createCsvStatementExtractor(path)
        self.assertIsNotNone(i)
        statements = i.statements()
        self.assertEqual(len(statements), 4)

        s:Statement = statements[0]
        t:BrokerageTransaction = s.brokerage_transactions[0]
        self.assertEqual(datetime.fromisoformat(t.trade_date), datetime(2020, 12, 3))

    def test_symbol_to_occ_code(self):
       self.assertEqual(MerrillEdge.symbolToOccCode("FSLY#A2023D450000"), "FSLY230120C00045000")
       self.assertEqual(MerrillEdge.symbolToOccCode("TWLO#A2023C130000"), "TWLO230120C00130000")

if __name__ == '__main__':
    unittest.main()

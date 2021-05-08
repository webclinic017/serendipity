from datetime import datetime
import os
import unittest

from serendipity.finance.extractors import createCsvStatementExtractor, CsvStatementExtractor
from serendipity.gen.finance.models import Statement

class TestFidelity(unittest.TestCase):
    def setUp(self):
        pass

    def test_fidelity_brokerage_401k(self):
        path = os.path.join(os.path.dirname(__file__), 'data/fidelity_brokerage_401k.pdf')
        i = createCsvStatementExtractor(path)
        self.assertIsNotNone(i)
        s = i.statement()
        self.assertEqual(s.account_number, "Z10-101010")
        self.assertEqual(datetime.fromisoformat(s.start_date), datetime(2020, 10, 1))
        self.assertEqual(datetime.fromisoformat(s.end_date), datetime(2020, 10, 31))
        self.assertEqual(s.institution_name, "Fidelity")

if __name__ == '__main__':
    unittest.main()

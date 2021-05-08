from ..extractors import createCsvStatementExtractor, CsvStatementExtractor
import os
import unittest

class TestImporter(unittest.TestCase):
    def setUp(self):
        pass

    def test_incorrect_file(self):
        path = os.path.join(os.path.dirname(__file__), 'not_a_real_file.pdf')
        with self.assertRaises(FileNotFoundError):
            i = createCsvStatementExtractor(path)

if __name__ == '__main__':
    unittest.main()

from datetime import datetime
import os
import unittest

from .. import createDocument, Document

class TestCsvDocument(unittest.TestCase):
    def setUp(self):
        pass

    def test_extraction_with_column_names(self):
        path = os.path.join(os.path.dirname(__file__), 'test_data.csv')
        doc = createDocument(path)
        self.assertIsNotNone(doc)
        table1 = doc.extractTable(
            tableName="Test Table 1", 
            firstColumnName="col1", 
            lastColumnName="col4",
            tableEndMarker="End Table"
        )
        shape = table1.shape
        self.assertEqual(shape[0], 2)
        self.assertEqual(shape[1], 4)

    def test_extraction_with_column_index(self):
        path = os.path.join(os.path.dirname(__file__), 'test_data.csv')
        doc = createDocument(path)
        self.assertIsNotNone(doc)
        table1 = doc.extractTable(
            tableName="Test Table 1", 
            firstColumnIndex=0, 
            lastColumnIndex=3,
            tableEndMarker="End Table"
        )
        shape = table1.shape
        self.assertEqual(shape[0], 2)
        self.assertEqual(shape[1], 4)

    def test_parital_column_extraction(self):
        path = os.path.join(os.path.dirname(__file__), 'test_data.csv')
        doc = createDocument(path)
        self.assertIsNotNone(doc)
        table1 = doc.extractTable(
            tableName="Test Table 1", 
            firstColumnName="col1", 
            lastColumnName="col3",
            tableEndMarker="End Table"
        )
        shape = table1.shape
        self.assertEqual(shape[0], 2)
        self.assertEqual(shape[1], 3)

    def test_no_table_name_extraction(self):
        path = os.path.join(os.path.dirname(__file__), 'test_data.csv')
        doc = createDocument(path)
        self.assertIsNotNone(doc)
        table1 = doc.extractTable(
            firstColumnName="col1", 
            lastColumnName="col3",
            tableEndMarker="End Table"
        )
        shape = table1.shape
        self.assertEqual(shape[0], 2)
        self.assertEqual(shape[1], 3)

    def test_no_table_end_marker_extraction(self):
        path = os.path.join(os.path.dirname(__file__), 'test_data.csv')
        doc = createDocument(path)
        self.assertIsNotNone(doc)
        table1 = doc.extractTable(
            tableName="Test Table 3", 
            firstColumnName="col1", 
            lastColumnName="col5",
        )
        shape = table1.shape
        self.assertEqual(shape[0], 3)
        self.assertEqual(shape[1], 2)

    def test_extraction_with_column_index2(self):
        path = os.path.join(os.path.dirname(__file__), 'test_data.csv')
        doc = createDocument(path)
        self.assertIsNotNone(doc)
        table1 = doc.extractTable(
            tableName="Test Table 3", 
            firstColumnIndex=0, 
            lastColumnIndex=1,
            tableEndMarker="End Table"
        )
        shape = table1.shape
        self.assertEqual(shape[0], 3)
        self.assertEqual(shape[1], 2)

    def test_nonexistent_table(self):
        path = os.path.join(os.path.dirname(__file__), 'test_data.csv')
        doc = createDocument(path)
        self.assertIsNotNone(doc)
        table1 = doc.extractTable(
            tableName="Test Table 2", 
            firstColumnIndex=0, 
            lastColumnIndex=1,
            tableEndMarker="End Table"
        )
        self.assertIsNone(table1)

if __name__ == '__main__':
    unittest.main()

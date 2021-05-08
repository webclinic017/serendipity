import csv
import pandas

from .document import Document

class CsvDocument(Document, extension="csv"):
    def __init__(self, filepath):
        super().__init__(filepath)

    def text(self) -> str:
        with open(self._filepath, "r") as f:
            return f.read()

    def extractTable(
        self, 
        tableName:str = "", 
        firstColumnName:str = "",
        firstColumnIndex:int = -1,
        lastColumnName:str = "",
        lastColumnIndex:int = -1,
        tableEndMarker:str = ""
    ) -> pandas.DataFrame:    

        tableFound = False
        headerFound = False
        df = None
        data = {}
        columns = []

        with open(self._filepath, "r") as f:
            csvreader = csv.reader(f)
            for row in csvreader:
                if headerFound:
                    if len(tableEndMarker) > 0 and any(tableEndMarker in val for val in row):
                        break
                    values = row[firstColumnIndex:(lastColumnIndex + 1)]
                    if len(values) == len(columns):
                        for val, col in zip(values, columns):
                            data[col].append(val.strip())
                elif tableFound:
                    if (len(firstColumnName) > 0 and any(firstColumnName in val for val in row)) or firstColumnIndex >= 0:
                        columnIndex = -1
                        firstColumnFound = False
                        for c in row:
                            columnIndex = columnIndex + 1
                            if not firstColumnFound:
                                firstColumnFound = (len(firstColumnName) > 0 and firstColumnName in c) or (columnIndex == firstColumnIndex)
                                if firstColumnFound:
                                    firstColumnIndex = columnIndex
                            if firstColumnFound:
                                c = c.strip()
                                data[c] = []
                                columns.append(c)
                                if (len(lastColumnName) > 0 and lastColumnName in c) or (columnIndex == lastColumnIndex):
                                    break
                        lastColumnIndex = columnIndex
                        headerFound = firstColumnFound and lastColumnIndex >= 0 
                elif len(tableName) == 0 or any(tableName in val for val in row):
                    tableFound = True

            if not tableFound or not headerFound:
                return None

        return pandas.DataFrame(data)

    def extractSingleTable(self) -> pandas.DataFrame:
        return pandas.read_csv(self._filepath)
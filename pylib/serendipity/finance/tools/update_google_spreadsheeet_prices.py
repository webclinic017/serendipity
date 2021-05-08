### Updates a google spreadsheet with the current market prices
###
### Reference: https://www.twilio.com/blog/2017/02/an-easy-way-to-read-and-write-to-a-google-spreadsheet-in-python.html

import os
import sys

module_root=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")
sys.path.append(module_root)

import argparse
import gspread
from serendipity.finance.utils.market_data import MarketData
from oauth2client.service_account import ServiceAccountCredentials

class CachedCells:
    _sheet: gspread.Spreadsheet
    _cells: [gspread.Cell]
    
    def __init__(self, sheet:gspread.Worksheet):
        self._sheet = sheet
        self._cells = sheet.range(1, 1, sheet.row_count, sheet.col_count)

    def cell(self, row: int, col: int):
        return self._cells[(row - 1) * self._sheet.col_count + col - 1]

parser = argparse.ArgumentParser(description="Update a Google Spreadsheet with the current market price")
parser.add_argument("--credentials", "-c",  help="Path to the credentials file", required=True)
parser.add_argument("--key", "-k",  help="The spreadsheet key", required=True)
parser.add_argument("--sheet", "-ss",  help="The sheet within the spreadsheet to update", required=True)

parsedArgs = parser.parse_args()

# use creds to create a client to interact with the Google Drive API
scope = ['https://spreadsheets.google.com/feeds']
creds = ServiceAccountCredentials.from_json_keyfile_name(parsedArgs.credentials, scope)
client = gspread.authorize(creds)

# Find a workbook by name and open the first sheet
# Make sure you use the right name here.
sheet = client.open_by_key(parsedArgs.key).sheet1

if sheet is None:
    raise RuntimeError("Sheet not found")

# Extract and print all of the values
cells = CachedCells(sheet)
securityCol = 0
currentPriceCol = 0
for colIndex in range(1, sheet.col_count):
    val = cells.cell(1, colIndex).value
    if val.lower() == "current price":
        currentPriceCol = colIndex
    elif val.lower() == "security":
        securityCol = colIndex

if securityCol <= 0:
    raise RuntimeError("Security column not found")

if currentPriceCol <= 0:
    raise RuntimeError("Current price column not found")

updatedCells=[]
for i in range(2,sheet.row_count):
    symbol:str =  cells.cell(i, securityCol).value
    if len(symbol) > 0:
        priceCell = cells.cell(i, currentPriceCol)
        priceCell.value = MarketData.currentPrice(symbol)
        updatedCells.append(priceCell)

if len(updatedCells) > 0:
    sheet.update_cells(updatedCells)
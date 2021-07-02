# Serendipity

Serendipity is a set of libraries and tools to aggregate, organize and visualize financial data from financial institutions such as brokerages and banks. 

Serendipity provides an API to import OFX, OFX variants like QFX and Microsoft Money, and CSV statements into structured models in python or javascript. Support for processing CSV statements for institutions that are not already supported can be easily added. A proof of concept for processing PDF statements has been implemented, but this requires extensive work and testing per institution.

Serendipity alo provides an API to export structured models into formats consumed by other tools, such as the CSV format used by Tiller Money.

Serendipity provides a google sheets library that uses the Yahoo Finance library to get market data for US stocks and options.

## Implemented Features

- Data can be imported from the following institutions:
    - Bank of America (QFX)
    - Capital One (QFX)
    - Chase (QFX)
    - Fidelity (CSV)
    - Interactive Brokers (CSV)
    - Merrill Edge (CSV,QFX)
    - Wells Fargo (QFX)
- Institution specific functionality:
    - Interactive Brokers
        - Download CSV files from flex queries
- Data can be exported to the following tools:
    - Tiller Money

## Using Serendipity via the CLI

## Institution Notes

### Merrill Edge

#### Export the current account holdings

1. Go to the [download page](https://olui2.fs.ml.com/TFPDownloads/TFPDownloads.aspx)
2. In `Choose category or account`, choose the accounts you want to export
3. In `Choose application`, choose `Spreadsheets and text`
4. In `Choose Settings`, choose `Security`. Ensure `Tax lots only` is checked
5. In `Download`, click the CSV button

#### Export the realized lots

**Note: This does not include dividends and interest**
1. Go to the [download page](https://olui2.fs.ml.com/TFPDownloads/TFPDownloads.aspx)
2. In `Choose category or account`, choose the accounts you want to export
3. In `Choose application`, choose `Spreadsheets and text`
4. In `Choose Settings`, choose `Realized gain/loss`. Ensure `Tax lots only` is checked
5. In `Download`, click the CSV button

#### Export activity (including divides and interest)
1. Go to the [download page](https://olui2.fs.ml.com/TFPDownloads/TFPDownloads.aspx)
2. In `Choose category or account`, choose the accounts you want to export
3. In `Choose application`, choose `Spreadsheets and text`
4. In `Choose Settings`, choose `Realized gain/loss`. Ensure `Tax lots only` is checked
5. In `Download`, click the CSV button

### Interactive Brokers

Setup a flex query to export the relevant data to Serendipity. For all flex queries select the following delivery
configuration:

- Format: CSV
- Include header and trailer records: Yes
- Include column headers: Yes
- Include section code and line descriptor: Yes

#### To export the realized Lots

In the Activity Flex Query Details, select the following:
- Trades
    - Options
        - Executions
        - Closed Lots
        - Wash Sales
    - Fields
        - Account Id
        - Cost Basis
        - Currency
        - Date/Time
        - Description
        - IB Commission
        - NetCash
        - Open/Close Indicator
        - Open Date Time
        - Quantity
        - Realized P/L or MTM P/L (depending on the type of reporting you'd like)
        - Settle Date Target
        - Symbol
        - Trade Price
        - Transaction Type
        - When Realized

#### To export the MTM P/L
In the Activity Flex Query Details, select the following:

- Trades
    - Options
        - Executions
    - Fields
        - Account Id
        - Currency
        - Date/Time
        - Description
        - IB Commission
        - NetCash
        - Quantity
        - MTM P/L
        - Settle Date Target
        - Symbol
        - Transaction Type
- Prior Period Positions
    - Fields
        - Account ID
        - Date
        - Description
        - Prior MTM PNL
        - Symbol
    - Fields
        - Account Id
        - Amount
        - Currency
        - Date/Time
        - Description
        - Settle Date
        - Symbol
        - Type

#### To export cash transactions

- Cash Transactions
    - Options
        - Dividends
        - Payment in Lieu of Dividends
        - Other Fees
        - Broker Interest Paid/Received
        - Bond Interest Paid/Received
        - Price Adjustments
        - Commission Adjustments
    - Fields
        - Account Id
        - Amount
        - Currency
        - Date/Time
        - Description
        - Settle Date
        - Symbol
        - Type

## Development Setup

**Note:** At the time of this writing only development on OS X is documented and tested, but development of should be possible on Linux and other Linux-like platforms like Cygwin as well.

The following development tools are required:

- Python 3.8 or above
- Node.js
- Java 8 or above
- OpenAPI generator

The steps in the following sections walk through the installation of these tools.

### Development Setup on OS X

1. [Install Java 8 or above](https://www.java.com/en/download/)
2. Install [homebrew](https://brew.sh)
3. Install Node.js via`brew install node`
4. Run `setup.sh` to install the rest of the dependencies.
5. Run `update_models.sh` to generate the OpenAPI models. 
    **Note:** This step will need to be rerun anytime the schema changes.

## Schema

The financial models used are represented via the OpenAPI schema to allow development across different languages.

Running `update_models.sh` generates the OpenAPI models for python and nodejs. This script needs to be run anytime the schema is updated to update the generated model classes.

## Running unit tests

- To run all the tests: ```run_tests.sh```
- To run a single test, run the following from the `pylib` directory: `python3 -m <test_module_name>`
    - Eg: `python3 -m serendipity.common.test.test_importer`

## Google Apps Script Library

Some of the functionality in Serendipity is surfaces as a Google Apps Script library for inclusion in Google sheets, and Google apps.

### Google Apps Script Development Workflow

Development is either in the Google cloud or locally via the use of the open source tool `clasp`.

1. Log into the google cloud: `cd gcloud/serendipity && clasp login`
2. Pull any changes (note this may override any local changes): `clasp pull`
3. Push any changes `clasp push`

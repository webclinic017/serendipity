# Serendipity

Serendipity is a set of libraries and tools to aggregate, organize and visualize financial data from financial institutions such as brokerages and banks. 

Serendipity provides an API to import OFX, OFX variants like QFX and Microsoft Money, and CSV statements into structured models in python or javascript. Support for processing CSV statements for institutions that are not already supported can be easily added. A proof of concept for processing PDF statements has been implemented, but this requires extensive work and testing per institution.

Serendipity alo provides an API to export structured models into formats consumed by other tools, such as the CSV format used by Tiller Money.

Serendipity provides a google sheets library that uses the Yahoo Finance library to get market data for US stocks and options.

## Tested for Importing

Data from the following institutions has been tested:

- Bank of America
- Capital One
- Chase
- Fidelity
- Interactive Brokers
- Merrill Edge
- Wells Fargo

### Merrill Edge

**To export the current account holdings**:

1. Go to the [download page](https://olui2.fs.ml.com/TFPDownloads/TFPDownloads.aspx)
2. In `Choose category or account`, choose the accounts you want to export
3. In `Choose application`, choose `Spreadsheets and text`
4. In `Choose Settings`, choose `Security`. Ensure `Tax lots only` is checked
5. In `Download`, click the CSV button

### Interactive Brokers

Setup a flex query to export the relevant data to Serendipity.

TODO: List of fields that are useful for Serendipity.

## Tested for Exporting

Data exported has been tested with the following tools:

- Tiller Money

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

### Development Workflow

Development is either in the Google cloud or locally via the use of the open source tool `clasp`.

1. Log into the google cloud: `cd gcloud/serendipity && clasp login`
2. Pull any changes (note this may override any local changes): `clasp pull`
3. Push any changes `clasp push`

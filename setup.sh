#!/bin/bash

script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "Installing python requirements"
python3 -m pip install -r ${script_dir}/pylib/requirements_py3.txt

lib_dir="${script_dir}/deps/lib"
mkdir -p "${lib_dir}"

echo "Downloading OpenAPI Generator"
open_api_version="5.0.0-beta2"

if [[ ! -f "${lib_dir}/openapi-generator-cli-${open_api_version}.jar" ]]
then
    echo "Downloading OpenAPI Generator ${open_api_version}"
    wget "https://repo1.maven.org/maven2/org/openapitools/openapi-generator-cli/${open_api_version}/openapi-generator-cli-${open_api_version}.jar" -O "${lib_dir}/openapi-generator-cli-${open_api_version}.jar"
else
    echo "OpenAPI Generator ${open_api_version} already downloaded"
fi

os=$(uname -s)
if [[ "$os" == "Darwin" ]]
then
    brew install gsed
fi

cd ${script_dir}/google_sheets/serendipity && npm install && cd -
cd ${script_dir}/js && npm install && cd -

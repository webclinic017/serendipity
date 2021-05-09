#!/bin/bash
root_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
# Python tests currently broken
#${root_dir}/pylib/run_tests.sh
cd ${root_dir}/js && npm run test && cd -

#!/bin/bash
root_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
${root_dir}/pylib/run_tests.sh
cd ${root_dir}/javascript && npm run test && cd -

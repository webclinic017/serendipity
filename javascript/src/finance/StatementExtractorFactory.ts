import * as fs from 'fs';
import * as path from 'path';

import { CsvStatementExtractor } from './CsvStatementExtractor';
import { OfxStatementExtractor } from './Ofx';
import { Statement } from '../gen/finance';

export class StatementExtractorFactory
{
    private static csvStatementExtractorClasses:{[key:string]: CsvStatementExtractor} = {};

    public static registerStatementCsvExtractorClass(cls: CsvStatementExtractor)
    {
        this.csvStatementExtractorClasses[cls.institutionName()] = cls;
        return true;
    }

    public static processStatement(file: string): Statement[]
    {
        let ext = path.extname(file).toLocaleLowerCase();
        if (ext == ".qfx" || ext == ".qbo") {
            let extractor = new OfxStatementExtractor();
            return extractor.process(fs.readFileSync(file).toString());
        }
        else if (ext == ".csv") {
            let cls:CsvStatementExtractor = null;
            let data = fs.readFileSync(file).toString();
            for (let key in this.csvStatementExtractorClasses) {
                let e = this.csvStatementExtractorClasses[key];
                if (e.canProcess(data)) {
                    if (cls != null) {
                        throw `More than one CSV extractor can process ${file}`;
                    }
                    cls = e;
                }
            }
            
            if (cls == null) {
                throw `CSV extractor could not be found for ${file}`;
            }

            let extractor:CsvStatementExtractor = Object.create(cls) as CsvStatementExtractor;
            extractor.constructor();
            return extractor.process(data);
        }
        return null;
    }
}

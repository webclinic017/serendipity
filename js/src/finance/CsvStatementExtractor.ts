import { Statement } from "../gen/finance/models";

export abstract class CsvStatementExtractor
{
    public abstract process(csv: string): Statement[];
    public abstract canProcess(csv: string): boolean;
    public abstract institutionName(): string;
}

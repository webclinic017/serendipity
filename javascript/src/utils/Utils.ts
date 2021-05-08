import * as csvParse from 'csv-parse/lib/sync';

export class Utils
{
    public static rowToJson(row: string[], columns: string[])
    {
        let obj:any = {};
        for (let i = 0; i < Math.min(row.length, columns.length); ++i) {
            obj[columns[i]] = row[i];
        }
        return obj;
    }

    public static rowsToJson(rows: string[][]): DefaultObject[] {
        let columns = rows[0];
        let ret = [];
        for (let r = 1; r < rows.length; ++r) {
            let row = rows[r];
            ret.push(Utils.rowToJson(rows[r], columns));
        }
        return ret;
    }

    public static parseCsvTrim(csv:string, delimiter:string = ","): string[][]
    {
        return (csvParse(csv, {
            trim: true,
            relax_column_count: true
        }) as string[][])
        .filter(e => (e.length > 0))
        .map(e => e.map(e => e.trim()));
    }

    public static normalizeNumberString(str: string)
    {
        if (str.length == 0)
            return str;

        if (str[0] == '(' && str[str.length - 1] == ')')
            str = `-${str.slice(1, str.length - 1)}`;
        return str.replace(/[^0-9\.\-]/g, '');
    }

    public static normalizeNumberStringToNumber(str: string): number
    {
        return Number(this.normalizeNumberString(str));
    }

    public static fallbackKeyValue(obj:DefaultObject, keys: string[])
    {
        for (let k of keys) {
            if (k in obj) {
                return obj[k];
            }
        }
        return "";        
    }
}

export type DefaultObject = {[key:string]: string};

#CSV2OFX

This code converts a CSV file into a OFX file. To accomplish a successful conversion it requires 3 separate files.

1. A CSV file, containing the bank transactions to be converted to OFX.
2. A settings.json file, to inform details about the CSV file (header, separator and date format), the data to be used on the OFX header section and a transaction template to create transactions in OFX.
3. A template.ofx file, which is **already provided**, but can be modified to attend more specific needs.

### Installing

This code is not yet an npm package, but you can clone the repository and run the command line to make conversions.

```
git clone https://github.com/lcassa/csv2ofx.git
```

Once you have the project locally simply run:

```
node index.js 
```

This command executes using the sample files already on the project, for more options run:

```
node index.js -h
Options:
  --version       Show version number                                  [boolean]
  --settings, -s  Full path for a settings.json file                    [string]
  --output, -o    Full path to the output file, if only a folder is provide a
                  file named results.ofx is created                     [string]
  --csv, -c       Full path to the .csv file used to map transactions   [string]
  --template, -t  Full path to a .ofx template file                     [string]
  --encoding, -e  Enconding to the output .ofx file                     [string]
  --help, -h      Show help                                            [boolean]
```

A very common set of options is:

```
node index.js -o ~/Documents/output.ofx -s ~/Documents/settings.json -c ~/Documents/transactions.csv
```

### The CSV file

This is whatever CSV file that holds transactions.

```
Desc;Date;Hour;Amount;Balance;Card
MY MEMO;10/1/19;7:13:00.000;3000;R$ 3.949,55;-
MEMO AGAIN;10/2/19;9:27;-2000;R$ 1.949,55;-
WHY NOT ANOTHER MEMO;10/2/19;9:27;-3,5;R$ 1.946,05;-
```

This sample file have 6 columns, some that can be ignored as the next section explains.

### Settings.json

As mentioned before this file is to set up the variables on the template.ofx file as well to configure some csv parameters.

```json
{
    "csvDateFormat": "M/D/YY",
    "csvSeparator": ";",
    "csvHeaders": ["MEMO", "DTPOSTED", "OMIT-HOUR", "TRNAMT", "BALAMT", "OMIT-CARDTYPE"],
    "csvFile": "sample-data/sample.csv",
    "template": {
        "bankId": "655",
        "accountId": "065526480972",
        "currDate": ""
    },
    "txTemplate": {
        "TRNTYPE": "",
        "DTPOSTED": "{date}100000[-03:EST]",
        "TRNAMT": "0",
        "FITID": "{date}{id}",
        "CHECKNUM": "{date}{id}",
        "MEMO": ""
    }
}
```

The example above is very straight forward. Here the more mysterious definitions:

`csvHeaders` according to your .csv file column order, how should they map to the .ofx pattern. Notice that any header set here that doesn't conform to the .ofx patter will be ignored, i.e. "OMIT-CARDTYPE"

`template` this object contains variables that are replaced in the template.ofx file. Wherever on your template.ofx the code finds a "bankId" represented by `{bankId}` it replaces with "123"

`txTemplate` each entry on your .csv file is mapped to a transaction (tx for short) on the output .ofx file. The 'txTemplate' provides a structure for each .ofx 'STMTTRN' (transaction) entry. It is not expected to have to modify this part of the 'settings.json', this structure is the one expected on .ofx files, also the {date} and {id} replacements and behaviour are hardcoded to fullfill the .ofx requirements.

### The template.ofx file

It is **recommended** to use the template.ofx file that is already provided with this code (same as sample bellow) which is used by default, unless you use the `-t` option when running the script. 

This is but a .ofx file to serve as structure to add your .csv file transactions and to mark down your replacing variables. Like {currDate}, {bankId} and whatever else you might need in the future.

```
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
    <SIGNONMSGSRSV1>
        <SONRS>
            <STATUS>
                <CODE>0
                <SEVERITY>INFO
            </STATUS>
            <DTSERVER>{currDate}100000[-03:EST]
            <LANGUAGE>POR
        </SONRS>
    </SIGNONMSGSRSV1>
    <BANKMSGSRSV1>
        <STMTTRNRS>
            <TRNUID>1001
            <STATUS>
                <CODE>0
                <SEVERITY>INFO
            </STATUS>
            <STMTRS>
                <CURDEF>BRL
                <BANKACCTFROM>
                    <BANKID>{bankId}
                    <ACCTID>{accountId}
                    <ACCTTYPE>CHECKING
                </BANKACCTFROM>
                <BANKTRANLIST>
                    <DTSTART>{currDateMonthStart}100000[-03:EST]
                    <DTEND>{currDateMonthEnd}100000[-03:EST]
                    <STMTTRN>
                        <TRNTYPE>DEBIT
                        <DTPOSTED>20191015100000[-03:EST]
                        <TRNAMT>-292.50
                        <FITID>20191015001
                        <CHECKNUM>20191015001
                        <MEMO>SOME DEBIT IN MY ACCOUNT
                    </STMTTRN>
                </BANKTRANLIST>
                <LEDGERBAL>
                    <BALAMT>2090.09
                    <DTASOF>{currDate}100000[-03:EST]
                </LEDGERBAL>
            </STMTRS>
        </STMTTRNRS>
    </BANKMSGSRSV1>
</OFX>
```

Notice a few variables not mentioned before:

`currDate` if set in the 'settings.json' it will use the provided date, otherwise it uses the current system date

`currDateMonthStart` uses the `currDate` as basis to find the first date of the month

`currDateMonthEnd` uses the `currDate` as basis to find the last date of the month

Don't worry the `<BALAMT>` having no variable, if the column is set on your `settings.json > csvHeaders` as the example above it keeps only the last transaction (CSV entry) as balance. Otherwise it sets to 0.
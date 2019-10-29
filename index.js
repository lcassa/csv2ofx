var fs = require('fs');
var ofx = require('ofx');
var moment = require('moment');
var applyTemplate = require('string-template');
var csv = require('csv-parser');
var yargs = require('yargs');

// source and destination files
var ofxTemplateFile = 'settings/template.ofx';
var ofxFileEncoding = 'utf8';
var ofxFileDest = 'sample-data/result.ofx'
var settingsFile = 'settings/settings.json';

// ofx constants
const TX_TYPE_CREDIT = 'CREDIT';
const TX_TYPE_DEBIT = 'DEBIT';
const MEMO_SIZE = 24;
const DATE_FORMAT = 'YYYYMMDD';
const PAD_LENGTH = 3;

// set default settings
var settings = {
    csvDateFormat: 'M/D/YY',
    csvSeparator: ';',
    csvFile: 'sample-data/sample.csv',
    csvHeaders: ['MEMO', 'DTPOSTED', 'HOUR', 'TRNAMT', 'BALAMT', 'CARDTYPE'],
    template: {
        bankId: '655',
        accountId: '065526480972',
        currDate: ''
    }
};

const argv = yargs
    .option('settings', {
        alias: 's',
        description: 'Full path for a settings.json file',
        type: 'string',
    })
    .option('output', {
        alias: 'o',
        description: 'Full path to the output file, if only a folder is provide a file named results.ofx is created',
        type: 'string',
    })
    .option('csv', {
        alias: 'c',
        description: 'Full path to the .csv file used to map transactions',
        type: 'string',
    })
    .option('template', {
        alias: 't',
        description: 'Full path to a .ofx template file',
        type: 'string',
    })
    .option('encoding', {
        alias: 'e',
        description: 'Enconding to the output .ofx file',
        type: 'string',
    })
    .help()
    .alias('help', 'h')
    .argv;

settingsFile = (argv.settings ? argv.settings : settingsFile);

// read settings file if any
if(fs.existsSync(settingsFile)) {
    settings = JSON.parse(fs.readFileSync(settingsFile));
    if(!settings.reportDate) {
        settings.reportDate = moment();
    }
}

// command line arguments supersede settings
ofxTemplateFile = (argv.template ? argv.template: ofxTemplateFile);
ofxFileEncoding = (argv.encoding ? argv.encoding: ofxFileEncoding);
ofxFileDest = (argv.output ? argv.output : ofxFileDest);
settings.csvFile = (argv.csv ? argv.csv : settings.csvFile);

fs.readFile(ofxTemplateFile, ofxFileEncoding, (err, ofxData) => {
    if (err) throw err;
    var template = settings.template;
    // template to create transactions
    var txTemplate = settings.txTemplate;

    // remove properties that are not defined on the settings.json txTemplate
    var cleanup = (data) => { 
        let filtered = {};
        Object.keys(txTemplate).forEach((entry) => { filtered[entry] = data[entry] });
        return filtered;
    };

    // convert currDate, currDateMonthStart and currDateMonthEnd
    var momentDate = template.currDate ? moment(template.currDate) : moment();
    template.currDate = momentDate.format(DATE_FORMAT);
    template.currDateMonthStart = momentDate.format(DATE_FORMAT);
    template.currDateMonthEnd = momentDate.format(DATE_FORMAT);
    
    // apply template
    var parsedOfxData = applyTemplate(ofxData, template);
    var transactions = [];
    var balance = '';
    var idCount = 0;
    var lastDate = null;
    // for each csv line mapped
    fs.createReadStream(settings.csvFile)
        .pipe(csv({ 
            headers: settings.csvHeaders,
            separator: settings.csvSeparator,
            skipLines: 1
        }))
        .on('data', (data) => {
            // save the last balance
            balance = data.BALAMT;
            // clean up data being received
            data = cleanup(data);
            let tx = JSON.parse(JSON.stringify(txTemplate));
            let date = moment(data.DTPOSTED, settings.csvDateFormat).format(DATE_FORMAT);
            if(lastDate === date) {
                idCount++;
            }
            else {
                idCount = 0;
            }
            lastDate = date;
            // replace commas with dots, as this is the default float separator for JS
            tx.TRNAMT = data.TRNAMT.replace(/,/,'.');
            if(parseFloat(data.TRNAMT) > 0) {
                tx.TRNTYPE = TX_TYPE_CREDIT;
            }
            else {
                tx.TRNTYPE = TX_TYPE_DEBIT;
            }
            // force MEMO chars limit
            tx.MEMO = data.MEMO.slice(0, MEMO_SIZE);
            // apply template to replace date and ids
            tx = JSON.parse(applyTemplate(JSON.stringify(tx), {
                date: date,
                id: idCount.toString().padStart(PAD_LENGTH, "0")
            }));
            transactions.push(tx);
        })
        .on('end', () => {
            let ofxObject = ofx.parse(parsedOfxData);
            // replace template transactions with CSV collected transactions
            ofxObject.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN = transactions;
            // define balance to 0 if none
            balance = balance ? balance : '0';
            // fix Brazilian locale balance representation with US
            balance = parseFloat(balance.replace(/\./, '').replace(/,/, '.').replace(/R\$/, '').replace(/\s+/,''));
            // apply final balance
            ofxObject.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.LEDGERBAL.BALAMT = balance;

            
            fs.writeFile(ofxFileDest, ofx.serialize(ofxObject.header, ofxObject.OFX), (err) => {
                if(err) {
                    return console.log(err);
                }
                console.log('The ' + ofxFileDest + ' file was saved!');
            }); 
        });
});
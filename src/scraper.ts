import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import path from 'path';
import * as fileManager from 'fs'; // Aliased fs
import csv from 'csv-parser';
import unzipper from 'unzipper';
import { Sequelize, DataTypes } from 'sequelize';

dotenv.config();

const databaseClient = new Sequelize('robot_db', 'root', process.env.MYSQL_PASSWORD, { 
    host: '127.0.0.1',
    dialect: 'mysql',
    logging: false 
});

const NameEntry = databaseClient.define('NameEntry', { 
    name: { type: DataTypes.STRING, allowNull: false },
    sex: { type: DataTypes.STRING, allowNull: false }
}, { tableName: 'BabyNames' }); 

async function handleZipData(zipArchiveLocation: string) { 
    const dataSet: { name: string; sex: string }[] = []; 
    console.log('Starting to process the downloaded ZIP file...');

    // Simplified Promise structure
    return new Promise<void>((complete, fail) => {
        fileManager.createReadStream(zipArchiveLocation) 
            .pipe(unzipper.Parse())
            .on('entry', function (zipFileEntry: any) { 
                const entryName = zipFileEntry.path; 
                if (entryName === "babyNamesUSYOB-full.csv") {
                    console.log(`Found ${entryName} inside the archive. Parsing now...`);
                    zipFileEntry.pipe(csv())
                        .on('data', (rowData: { Name?: string; Sex?: string }) => { 
                            if (rowData.Name && rowData.Sex) {
                                dataSet.push({ name: rowData.Name, sex: rowData.Sex });
                            }
                        })
                        .on('end', async () => {
                            console.log(`✅ CSV file successfully processed. Found ${dataSet.length} records.`);
                            try {
                                if (dataSet.length > 0) {
                                    console.log('Inserting records into the database in batches...');
                                    const BATCH_SIZE_LIMIT = 1500; 
                                    for (let k = 0; k < dataSet.length; k += BATCH_SIZE_LIMIT) { 
                                        const chunk = dataSet.slice(k, k + BATCH_SIZE_LIMIT); 
                                        await NameEntry.bulkCreate(chunk); 
                                    }
                                    console.log('✅ Database insertion complete!');
                                }
                                complete();
                            } catch (databaseError) { 
                                console.error('❌ Error inserting data into the database:', databaseError);
                                fail(databaseError);
                            }
                        });
                } else {
                    zipFileEntry.autodrain();
                }
            })
            .on('error', (streamError: any) => { 
                console.error('❌ Error processing ZIP file:', streamError);
                fail(streamError);
            });
    });
}

async function runDataScraper() { 
    console.log('--- Main Scraper ---');
    console.log('Starting the web data collection...');

    const browserInst = await chromium.launch({ headless: false }); 
    const targetPage = await browserInst.newPage(); 

    console.log('Navigating to Kaggle login page...');
    await targetPage.goto('https://www.kaggle.com/account/login');

    await targetPage.locator('span:has-text("Sign in with email")').click();
    console.log('Auth form revealed.');

    await targetPage.locator('input[name="email"]').fill(process.env.KAGGLE_EMAIL!);
    await targetPage.locator('input[name="password"]').fill(process.env.KAGGLE_PASSWORD!);
    await targetPage.locator('button:has-text("Sign In")').click();
    console.log('Logging in...');

    await targetPage.waitForURL('https://www.kaggle.com/');
    console.log('✅ Successfully logged in!');

    const dataSourceUrl = 'https://www.kaggle.com/datasets/thedevastator/us-baby-names-by-year-of-birth?select=babyNamesUSYOB-full.csv';
    console.log(`Navigating to dataset page: ${dataSourceUrl}`);
    await targetPage.goto(dataSourceUrl);

    try {
        await targetPage.locator('button:has-text("Accept")').click({ timeout: 4000 });
        console.log('✅ Cookie banner accepted.');
    } catch {
        console.log('Cookie banner not found, continuing...');
    }

    const fileDownloadPromise = targetPage.waitForEvent('download'); 
    console.log('Looking for the specific download label...');
    await targetPage.getByLabel('Download').click();
    console.log('⬇️ Download button clicked. Waiting for download...');

    const fileHandle = await fileDownloadPromise; 
    const downloadSavePath = path.join(__dirname, '../temp/kaggle-download.zip'); 
    await fileHandle.saveAs(downloadSavePath);
    console.log(`✅ File downloaded and saved to: ${downloadSavePath}`);

    await browserInst.close();
    console.log('Browser closed. Scraping finished.');

    await handleZipData(downloadSavePath); 

    console.log('System task successfully finished. Exiting.'); 
}

runDataScraper().catch(executionError => { 
    console.error('❌ An error occurred during execution:', executionError);
    process.exit(1);
});


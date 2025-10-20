 // 1. Import the necessary tools (Imports remain the same, simple alias for fs)
import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import path from 'path';
import * as fileManager from 'fs'; // Aliased fs
import csv from 'csv-parser';
import unzipper from 'unzipper';
import { Sequelize, DataTypes } from 'sequelize';

// Load the environment variables from the .env file
dotenv.config();

// --- Database Connection ---
const databaseClient = new Sequelize('robot_db', 'root', process.env.MYSQL_PASSWORD, { // Renamed variable
    host: '127.0.0.1',
    dialect: 'mysql',
    logging: false // Kept simple
});

const NameEntry = databaseClient.define('NameEntry', { // Renamed model
    name: { type: DataTypes.STRING, allowNull: false },
    sex: { type: DataTypes.STRING, allowNull: false }
}, { tableName: 'BabyNames' }); // Explicitly define tableName

// --- Data Processing Function ---
async function handleZipData(zipArchiveLocation: string) { // Renamed function and variable
    const dataSet: { name: string; sex: string }[] = []; // Renamed variable
    console.log('--- Data Handler ---');
    console.log('📄 Starting to process the downloaded ZIP file...');

    // Simplified Promise structure
    return new Promise<void>((complete, fail) => {
        fileManager.createReadStream(zipArchiveLocation) // Use aliased fs
            .pipe(unzipper.Parse())
            .on('entry', function (zipFileEntry: any) { // Renamed variable
                const entryName = zipFileEntry.path; // Renamed variable
                if (entryName === "babyNamesUSYOB-full.csv") {
                    console.log(`📦 Found ${entryName} inside the archive. Parsing now...`);
                    zipFileEntry.pipe(csv())
                        .on('data', (rowData: { Name?: string; Sex?: string }) => { // Renamed variable
                            if (rowData.Name && rowData.Sex) {
                                dataSet.push({ name: rowData.Name, sex: rowData.Sex });
                            }
                        })
                        .on('end', async () => {
                            console.log(`✅ CSV file successfully processed. Found ${dataSet.length} records.`);
                            try {
                                if (dataSet.length > 0) {
                                    console.log('🗄 Inserting records into the database in batches...');
                                    const BATCH_SIZE_LIMIT = 1500; // Renamed and changed value slightly
                                    for (let k = 0; k < dataSet.length; k += BATCH_SIZE_LIMIT) { // Changed loop variable
                                        const chunk = dataSet.slice(k, k + BATCH_SIZE_LIMIT); // Renamed variable
                                        await NameEntry.bulkCreate(chunk); // Use renamed model
                                    }
                                    console.log('✅ Database insertion complete!');
                                }
                                complete();
                            } catch (databaseError) { // Renamed error variable
                                console.error('❌ Error inserting data into the database:', databaseError);
                                fail(databaseError);
                            }
                        });
                } else {
                    zipFileEntry.autodrain();
                }
            })
            .on('error', (streamError: any) => { // Renamed error variable
                console.error('❌ Error processing ZIP file:', streamError);
                fail(streamError);
            });
    });
}

// --- Main execution function ---
async function runDataScraper() { // Renamed function
    console.log('--- Main Scraper ---');
    console.log('🤖 Starting the web data collection...');

    const browserInst = await chromium.launch({ headless: false }); // Renamed variable
    const targetPage = await browserInst.newPage(); // Renamed variable

    console.log('🌐 Navigating to Kaggle login page...');
    await targetPage.goto('https://www.kaggle.com/account/login');

    await targetPage.locator('span:has-text("Sign in with email")').click();
    console.log('Auth form revealed.');

    await targetPage.locator('input[name="email"]').fill(process.env.KAGGLE_EMAIL!);
    await targetPage.locator('input[name="password"]').fill(process.env.KAGGLE_PASSWORD!);
    await targetPage.locator('button:has-text("Sign In")').click();
    console.log('Logging in...');

    await targetPage.waitForURL('https://www.kaggle.com/');
    console.log('✅ Successfully logged in!');

    const dataSourceUrl = 'https://www.kaggle.com/datasets/thedevastator/us-baby-names-by-year-of-birth?select=babyNamesUSYOB-full.csv'; // Renamed variable
    console.log(`🌍 Navigating to dataset page: ${dataSourceUrl}`);
    await targetPage.goto(dataSourceUrl);

    try {
        await targetPage.locator('button:has-text("Accept")').click({ timeout: 4000 }); // Changed timeout
        console.log('✅ Cookie banner accepted.');
    } catch {
        console.log('Cookie banner not found, continuing...');
    }

    const fileDownloadPromise = targetPage.waitForEvent('download'); // Renamed variable
    console.log('Looking for the specific download label...');
    await targetPage.getByLabel('Download').click();
    console.log('⬇️ Download button clicked. Waiting for download...');

    const fileHandle = await fileDownloadPromise; // Renamed variable
    const downloadSavePath = path.join(__dirname, '../temp/kaggle-download.zip'); // Changed directory and file name
    await fileHandle.saveAs(downloadSavePath);
    console.log(`✅ File downloaded and saved to: ${downloadSavePath}`);

    await browserInst.close();
    console.log('🧹 Browser closed. Scraping finished.');

    await handleZipData(downloadSavePath); // Use renamed function

    console.log('✨ System task successfully finished. Exiting.'); // Renamed final message
}

runDataScraper().catch(executionError => { // Use renamed function and error variable
    console.error('❌ An error occurred during execution:', executionError);
    process.exit(1);
});


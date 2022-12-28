const { Prisma } = require("@prisma/client");

const queue = [];
const maxRetries = 5;
let ready = true;
let retries = 0;

/*

Database failed because of an open transation while trying
to write or read the database. Implement queue should work
in fixing this issue since transactions cannot be called
at the same time and try to access a locked database.

Add an item to the queue and make it await-able so that
I can wait for updates or read data without having to wait
for the entire queue to be done.

*/

async function wait(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    });
}

async function nextQueueItem() {
    if (ready) {
        ready = false;
        //await prisma.$connect()
        let queueItem = queue.shift();
        let itemData;
        while(retries < maxRetries) {
            try {
                if (queueItem.item) {
                    itemData = await queueItem.item;
                } else if (queueItem.query) {
                    itemData = prisma[queueItem.database][queueItem.query](queueItem.data);
                } else if (queueItem.array) {
                    itemData = prisma.$transaction(queueItem.array);
                }
                break;
            } catch {
                console.log("couldnt complete, retrying...");
                await wait(1000);
                retries++;
            }
        }
        if (retries == maxRetries) {
            console.log("couldnt complete, out of retries");
        }
        queueItem.callback(itemData);
        //await prisma.$disconnect()
        retries = 0;
        ready = true;
        //console.log(queue.length);
        if (queue.length > 0) {
            nextQueueItem();
        }
    }
}

function addToExecuteQueue(item, callback) {
    queue.push({
        item: item,
        callback: callback
    });
    nextQueueItem();
}

function addToQueryQueue(database, query, data, callback) {
    queue.push({
        database: database,
        query: query,
        data: data,
        callback: callback
    });
    nextQueueItem();
}

function addToTransactionQueue(array, callback) {
    queue.push({
        array: array,
        callback: callback
    });
    nextQueueItem();
}

async function execute(query) {
    return new Promise(async (resolve, reject) => {
        addToExecuteQueue(query, (result) => {
            if (result instanceof Prisma.PrismaClientKnownRequestError) {
                console.log("failed failure");
                reject(result);
            }
            resolve(result);
        });
    });
}

async function query(database, query, data) {
    return new Promise(async (resolve, reject) => {
        addToQueryQueue(database, query, data, (result) => {
            if (result instanceof Prisma.PrismaClientKnownRequestError) {
                console.log("failed failure");
                reject(result);
            }
            //console.log(result);
            resolve({
                query: result
            });
        });
    });
}

async function transaction(array) {
    return new Promise(async (resolve, reject) => {
        addToTransactionQueue(array, (result) => {
            if (result instanceof Prisma.PrismaClientKnownRequestError) {
                console.log("failed failure");
                reject(result);
            }
            //console.log(result);
            resolve({
                transaction: result
            });
        });
    });
}


module.exports = {
    execute, query, transaction
}
/*

error when querying data without cache: if using AS, then AS gets saved to cache with the name. provide table setup to fix this issue

*/

const { equal } = require('assert');

const Surreal = require('surrealdb.js').default;
const fs = require('fs').promises;

let db, nsName, dbName, saveInterval;

let cache = {

};

const STATEMENTS = ["CREATE", "UPDATE", "RELATE", "SELECT", "SET"];
const CREATE_STATEMENTS = ["CONTENT", "SET", "RETURN", "TIMEOUT", "PARALLEL"];
const UPDATE_STATEMENTS = ["CONTENT", "MERGE", "PATCH", "SET", "WHERE", "RETURN", "TIMEOUT", "PARALLEL"];
const SELECT_STATEMENTS = ["FROM", "WHERE", "SPLIT", "GROUP", "ORDER", "LIMIT", "START", "FETCH", "TIMEOUT", "PARALLEL"];
const SET_STATEMENTS = ["=", "+=", "-="];

async function setup(url, filename){
    return new Promise(async (resolve, reject) => {
        try {
            db = new Surreal(url);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

async function rootSignIn(user, pass){
    return new Promise(async (resolve, reject) => {
        try {
            await db.signin({
                user: user,
                pass: pass
            });
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

async function use(namespace, database){
    return new Promise(async (resolve, reject) => {
        try {
            await db.use(namespace, database);
            nsName = namespace;
            dbName = database;
            resolve();
        } catch (error) {
            reject(error);
        }
    });
}

async function queryRaw(sql) {
    return new Promise(async (resolve, reject) => {
        try {
            let results = await db.query(sql);
            //saveToCache(result);
            resolve(results);
        } catch (error) {
            reject(error);
        }
    });
}

async function query(sql, force=false){
    return new Promise(async (resolve, reject) => {
        try {
            // let results = [];
            // let parsedSQL = parseSQL(sql);
            // for(let q of parsedSQL){
            //     //if (q.statement == "SELECT" && inCache(q) && !force) {
            //         //results.push(fetchFromCache(q));
            //         //console.log("used cache!");
            //     //} else {
            //         let rawResults = await queryRaw(q.raw);
            //         //console.log(rawResults.map(r => r.result));
            //         results.push(rawResults.map(r => r.result)[0]);
            //         //saveToCache(rawResults);
            //         //console.log("used live!");
            //     //}
            // }
            let results = await queryRaw(sql);
            resolve(results);
        } catch (error) {
            reject(error);
        }
    });
}

function _parseSQL_SET(lines, startingLine, stopAtStatements) {
    let set = {
        equal: [],
        add: [],
        remove: []
    };
    let line = startingLine;
    let nextSet = lines.slice(line, line + 3);
    while (!stopAtStatements.includes(nextSet[0]) && nextSet.length == 3) {
        if (nextSet[1] == "=") {
            set.equal.push([nextSet[0], nextSet[2]]);
        } else if (nextSet[1] == "+=") {
            set.add.push([nextSet[0], nextSet[2]]);
        } else if (nextSet[1] == "-=") {
            set.remove.push([nextSet[0], nextSet[2]]);
        }
        line += 3;
        nextSet = lines.slice(line, line + 3);
    }
    return set;
}

function _parseSQL_WHERE(lines, startingLine, stopAtStatements) {
    let select = {
        equal: []
    };
    let line = startingLine;
    let nextSet = lines.slice(line, line + 3);
    while (!stopAtStatements.includes(nextSet[0]) && nextSet.length == 3) {
        if (nextSet[1] == "=") {
            select.equal.push([nextSet[0], nextSet[2]]);
        }
        line += 3;
        nextSet = lines.slice(line, line + 3);
    }
    return select;
}

function _parseSQL_PROJECTIONS(lines, startingLine, stopAtStatements) {
    let projections = {

    };
    let line = startingLine;
    let nextSet = lines.slice(line, line + 3);
    while (!stopAtStatements.includes(nextSet[0]) && nextSet.length == 3) {
        if (nextSet[1] == "AS") {
            projections[nextSet[2]] = nextSet[0];
            line += 3;
            nextSet = lines.slice(line, line + 3);
        } else {
            projections[nextSet[0]] = nextSet[0];
            line += 1;
            nextSet = lines.slice(line, line + 3);
        }
    }
    return [projections, line];
}

function parseSQL(sql) {
    let parsedSQL = [];
    let queries = sql.split(";");
    let queriesSplit = [];
    for(let index in queries){
        queries[index] = queries[index].replace((/  |\r\n|\n|\r/gm), "").trim();
        if (queries[index] == ""){
            queries.splice(index, 1);
            continue;
        }
        let split = [""];
        let position = 0;
        let invalidBreaks = 0;
        let doubleQuoteDetected = false;
        let singleQuoteDetected = false;
        for(let char = 0; char < queries[index].length; char++){
            let charValue = queries[index][char];
            if (charValue == "{") {
                invalidBreaks++;
            } else if (charValue == "}") {
                invalidBreaks--;
            } else if (charValue == "("){
                invalidBreaks++;
            } else if (charValue == ")"){
                invalidBreaks--;
            } else if (charValue == "\"" && !doubleQuoteDetected) {
                doubleQuoteDetected = true;
                invalidBreaks++;
            } else if (charValue == "\"" && doubleQuoteDetected) {
                doubleQuoteDetected = false;
                invalidBreaks--;
            } else if (charValue == "'" && !singleQuoteDetected) {
                singleQuoteDetected = true;
                invalidBreaks++;
            } else if (charValue == "'" && singleQuoteDetected) {
                singleQuoteDetected = false;
                invalidBreaks--;
            }
            if (charValue == " " && invalidBreaks == 0){
                split.push("");
                position++;
                continue;
            }
            split[position] += queries[index][char];
        }
        let parsed = {
            raw: split.join(" "),
            statement: split[0]
        };
        split = split.map(l => l.replace(/,\s*$/, ""));
        queriesSplit.push(split);
        let line = 1;
        switch (parsed.statement){
            case "CREATE":
                parsed.targets = split[1];
                if (split[2] == "CONTENT") {
                    parsed.content = split[3];
                } else if(split[2] == "SET"){
                    parsed.set = _parseSQL_SET(split, 3, CREATE_STATEMENTS);
                }
                break;
            case "UPDATE":
                parsed.targets = split[1];
                if (split[2] == "CONTENT") {
                    parsed.content = split[3];
                } else if (split[2] == "MERGE") {
                    parsed.merge = split[3];
                } else if (split[2] == "PATCH") {
                    parsed.patch = split[3];
                } else if (split[2] == "SET") {
                    parsed.set = _parseSQL_SET(split, 3, UPDATE_STATEMENTS);
                }
                break;
            case "SELECT":
                [parsed.projections, line] = _parseSQL_PROJECTIONS(split, line, SELECT_STATEMENTS);
                parsed.targets = split[++line];
                if (split[++line] == "WHERE"){
                    parsed.where = _parseSQL_WHERE(split, ++line, SELECT_STATEMENTS);
                }
            default:
                break;
        }
        parsedSQL.push(parsed);
        
        // for(let line = 0; line < queriesSplit[index].length; line++){
        //     if(STATEMENTS.includes(line)){
        //         mode = line;
        //     } else if(mode == "SET") {

        //     }
        // }
    }
    //console.log(queriesSplit);
    //console.log(parsedSQL);
    try {
        //console.log(parsedSQL[0].where.equal);
    } catch {

    }
    return parsedSQL;
}

function _idFromID(id) {
    return id.substring(id.indexOf(":") + 1);
}

function _tableFromID(id) {
    return id.substring(0, id.indexOf(":"));
}

function _cacheFindObjectInTable(table, id) {
    try {
        return cache[table].find(obj => {
            return obj.id == id;
        });
    } catch {
        return;
    }
}

function _cacheFindObjectFromID(id) {
    let object;
    for(let table in cache){
        object = object || _cacheFindObjectInTable(table, id);
        if (object !== undefined) break;
    }
    return object;
}

function _cacheFindIndexOfObjectFromIDWithTable(table, id) {
    let object = _cacheFindObjectInTable(table, id);
    try {
        return cache[table].indexOf(object);
    } catch {
        return -1;
    }
}

function _cacheFindIndexOfObjectFromID(id) {
    let table = _tableFromID(id);
    let object = _cacheFindObjectInTable(table, id);
    try {
        return cache[table].indexOf(object);
    } catch {
        return -1;
    }
}

function _cacheHasTable(table) {
    return cache.hasOwnProperty(table);
}

function _cacheAdd(id, object){
    let table = _tableFromID(id);
    if (!_cacheHasTable(table)) cache[table] = [];
    cache[table].push(object);
}

function _cacheMerge(id, object) {
    Object.assign(cache[_tableFromID(id)][_cacheFindIndexOfObjectFromID(id)], object);
}

function saveToCache(queryResults) {
    //console.log(queryResults);
    for(let results of queryResults){
        if (results.status !== "OK") {
            console.error("error occured");
            return;
        }
        for(let result of results.result){
            if (result.hasOwnProperty("id")) {
                let index = _cacheFindIndexOfObjectFromID(result.id);
                if (index == -1) {
                    _cacheAdd(result.id, result);
                } else {
                    _cacheMerge(result.id, result);
                }
            }
        }
    }
}

function _cacheFindTargets(rawTargets) {
    let targets = {};
    if (rawTargets.indexOf(":") == -1){
        targets.table = rawTargets;
    } else {
        targets.id = _idFromID(rawTargets);
    }
    return targets;
}

function _cacheFilterTargetsByWhere(targets, rawWhere) {
    let where = [];
    if (targets.hasOwnProperty("table")) {
        if (_cacheHasTable(targets.table)) {
            targets = [...cache[targets.table]];
        } else {
            targets = [];
        }
    }
    if (rawWhere == undefined) return targets;
    for(let target of targets){
        let valid = true;
        if(rawWhere.hasOwnProperty("equal")){
            for(let equalCondition of rawWhere.equal){
                if(target[equalCondition[0]] != equalCondition[1]){
                    valid = false;
                }
            }
        }
        if(valid){
            where.push(target);
        }
    }
    return where;
}

function _cacheFilterWhereByProjections(where, rawProjections) {
    let projections = Array(where.length).fill({});
    for (let projection in rawProjections) {
        if (projection == "*" || rawProjections[projection] == "*") {
            for(let w = 0; w < where.length; w++){
                Object.assign(projections[w], where[w]);
            }
        } else {
            for (let w = 0; w < where.length; w++) {
                projections[w][projection] = where[w][rawProjections[projection]];
            }
        }
    }
    return projections;
}

function _cacheMatchKeys(a={}, b={}) {
    var aKeys = Object.keys(a).sort();
    var bKeys = Object.keys(b).sort();
    return JSON.stringify(aKeys) == JSON.stringify(bKeys);
}

function inCache(sql) {
    let targets = _cacheFindTargets(sql.targets);
    let where = _cacheFilterTargetsByWhere(targets, sql.where);
    let projections = _cacheFilterWhereByProjections(where, sql.projections);
    let inCache = (projections.length > 0) ? true : false;
    //console.log(projections);
    for (let item of projections){
        //console.log(item);
        //console.log("object:", _cacheFindObjectFromID(item.id));
        //console.log("item:", item);
        //console.log("match:", _cacheMatchKeys(_cacheFindObjectFromID(item.id), item));
        if (_cacheHasTable(targets.table) == undefined && _cacheFindObjectFromID(item.id) == undefined && _cacheMatchKeys(_cacheFindObjectFromID(item.id), item)) {
            inCache = false;
        }
    }
    return inCache;
}

function fetchFromCache(sql) {
    let targets = _cacheFindTargets(sql.targets);
    let where = _cacheFilterTargetsByWhere(targets, sql.where);
    let projections = _cacheFilterWhereByProjections(where, sql.projections);
    // if(targets.hasOwnProperty("id")){
    //     return [_cacheFindObjectFromID(sql.targets)];
    // } else if (targets.hasOwnProperty("table")) {
    //     return [...cache[targets.table]];
    // }
    return projections;
}

async function exportCacheToFile() {
    let data = JSON.stringify(cache);
    await fs.writeFile(`${nsName}-${dbName}.cache`, data);
    console.log("saved cache");
}

async function importCacheFromFile() {
    try {
        let rawdata = await fs.readFile(`${nsName}-${dbName}.cache`);
        cache = JSON.parse(rawdata);
        //saveInterval = setInterval(exportCacheToFile, 300000) // 5 min
    } catch {
        cache = {};
    }
}

function getCache(){
    return cache;
}

async function clearCache(){
    cache = {};
    await fs.writeFile(`${nsName}-${dbName}.cache`, JSON.stringify(cache));
}

module.exports = {
    setup, rootSignIn, use, query, queryRaw, getCache, exportCacheToFile, importCacheFromFile, clearCache
}
// Collects every key matching a pattern with SCAN instead of KEYS.
// KEYS walks the whole keyspace in one blocking call; SCAN does it in small batches,
// so the simulator's writes are never held up while a list is being read.
async function scanKeys(client, pattern, count = 200) {
    const found = new Set();
    let cursor = '0';
    do {
        const reply = await client.scan(cursor, { MATCH: pattern, COUNT: count });
        cursor = String(reply.cursor);
        reply.keys.forEach((k) => found.add(k)); // SCAN may return a key more than once
    } while (cursor !== '0');
    return [...found];
}

module.exports = scanKeys;

import neo4j, { Driver } from 'neo4j-driver';

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USERNAME;
const password = process.env.NEO4J_PASSWORD;

if (!uri || !user || !password) {
  console.warn('Missing Neo4j environment variables. Please check your .env.local file.');
}

// Global variable to maintain driver instance across hot-reloads
declare global {
  var neo4jDriver: Driver | undefined;
}

let driver: Driver;

if (process.env.NODE_ENV === 'production') {
  driver = neo4j.driver(
    uri || 'neo4j://localhost',
    neo4j.auth.basic(user || 'neo4j', password || 'password')
  );
} else {
  if (!global.neo4jDriver) {
    global.neo4jDriver = neo4j.driver(
      uri || 'neo4j://localhost',
      neo4j.auth.basic(user || 'neo4j', password || 'password')
    );
  }
  driver = global.neo4jDriver;
}

export const getNeo4jDriver = () => driver;

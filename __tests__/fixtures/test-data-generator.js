/**
 * Wing Test Data Generator
 * Generates realistic test data for manual testing
 *
 * Usage:
 *   node __tests__/fixtures/test-data-generator.js
 *
 * This creates a JSON file that can be imported via the extension's Import feature.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample data for realistic wings
const sampleSites = [
  { domain: 'developer.mozilla.org', category: 'Documentation' },
  { domain: 'stackoverflow.com', category: 'Q&A' },
  { domain: 'github.com', category: 'Code' },
  { domain: 'medium.com', category: 'Articles' },
  { domain: 'dev.to', category: 'Community' },
  { domain: 'css-tricks.com', category: 'Tutorials' },
  { domain: 'smashingmagazine.com', category: 'Design' },
  { domain: 'news.ycombinator.com', category: 'News' },
  { domain: 'reddit.com', category: 'Discussion' },
  { domain: 'twitter.com', category: 'Social' },
  { domain: 'youtube.com', category: 'Video' },
  { domain: 'wikipedia.org', category: 'Reference' },
];

const topics = [
  'JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js',
  'Python', 'Machine Learning', 'AI', 'CSS', 'HTML', 'Web APIs',
  'Database', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes',
  'AWS', 'Cloud Computing', 'DevOps', 'CI/CD', 'Testing', 'Security',
  'Performance', 'Accessibility', 'SEO', 'UX Design', 'Product Management'
];

const summaryTemplates = [
  'A comprehensive guide to {topic} covering fundamentals and advanced concepts.',
  'This article explains how {topic} works and best practices for implementation.',
  'Learn about {topic} with practical examples and real-world use cases.',
  'Deep dive into {topic}: architecture, patterns, and common pitfalls.',
  'Getting started with {topic}: a beginner-friendly tutorial.',
  'Advanced techniques for {topic} that will improve your workflow.',
  'Comparing different approaches to {topic} in modern development.',
  'Understanding {topic}: concepts, tools, and ecosystem overview.',
];

const highlightTexts = [
  'This is a key concept that everyone should understand.',
  'Important: Always remember to handle edge cases properly.',
  'Pro tip: Use this technique to improve performance significantly.',
  'Note: This approach has trade-offs you should consider.',
  'Best practice: Follow this pattern for maintainable code.',
];

const annotations = [
  'Need to revisit this concept',
  'Great explanation!',
  'Apply this to current project',
  'Share with team',
  'Disagree with this approach',
  'Very useful for interviews',
  null, // Some highlights without annotations
  null,
];

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack = 90) {
  const now = Date.now();
  const past = now - (Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return Math.floor(past);
}

function generateSummary(topic) {
  const template = randomItem(summaryTemplates);
  return template.replace('{topic}', topic);
}

function generateWing(collectionIds = [], nestIds = []) {
  const site = randomItem(sampleSites);
  const topic = randomItem(topics);
  const id = generateId();

  return {
    id,
    url: `https://${site.domain}/articles/${topic.toLowerCase().replace(/\s+/g, '-')}-${id.slice(-6)}`,
    title: `${topic}: ${randomItem(['Guide', 'Tutorial', 'Deep Dive', 'Introduction', 'Best Practices', 'Overview'])}`,
    summary: generateSummary(topic),
    favicon: `https://www.google.com/s2/favicons?domain=${site.domain}&sz=32`,
    timestamp: randomDate(),
    collectionIds: collectionIds,
    nestIds: nestIds,
  };
}

function generateCollection(index) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];

  const names = [
    'Web Development', 'Machine Learning', 'DevOps', 'Design Inspiration',
    'Career Growth', 'Side Projects', 'Learning Resources', 'Tools & Utilities',
    'News & Updates', 'Research Papers', 'Tutorials', 'Reference Docs'
  ];

  return {
    id: generateId(),
    name: names[index % names.length] || `Collection ${index + 1}`,
    description: `A curated collection of resources about ${names[index % names.length] || 'various topics'}`,
    color: colors[index % colors.length],
    timestamp: randomDate(180),
  };
}

function generateNest(collectionId, parentNestId = null, name) {
  return {
    id: generateId(),
    collectionId,
    parentNestId,
    name,
    timestamp: randomDate(90),
  };
}

function generateHighlight(wingId) {
  return {
    id: generateId(),
    wingId,
    text: randomItem(highlightTexts),
    annotation: randomItem(annotations),
    startOffset: Math.floor(Math.random() * 1000),
    endOffset: Math.floor(Math.random() * 1000) + 1000,
    xpath: '/html/body/article/p[1]',
    timestamp: randomDate(60),
  };
}

function generateConnection(wingId1, wingId2, score) {
  return {
    id: generateId(),
    wingId1,
    wingId2,
    score,
    type: randomItem(['semantic', 'collection', 'manual']),
    timestamp: randomDate(30),
  };
}

function generateTestData(options = {}) {
  const {
    wingCount = 55,
    collectionCount = 6,
    nestCount = 8,
    highlightCount = 15,
    connectionCount = 20,
  } = options;

  // Generate collections
  const collections = [];
  for (let i = 0; i < collectionCount; i++) {
    collections.push(generateCollection(i));
  }

  // Generate nests (some nested)
  const nests = [];
  const nestNames = [
    'Beginner', 'Intermediate', 'Advanced',
    'Frontend', 'Backend', 'Full Stack',
    'Quick Reads', 'Deep Dives'
  ];

  for (let i = 0; i < nestCount; i++) {
    const collectionId = collections[i % collections.length].id;
    const parentNestId = i > 3 && nests.length > 0 ? nests[Math.floor(i / 2) - 1]?.id : null;
    nests.push(generateNest(collectionId, parentNestId, nestNames[i % nestNames.length]));
  }

  // Generate wings with varied collection/nest assignments
  const wings = [];
  for (let i = 0; i < wingCount; i++) {
    let collectionIds = [];
    let nestIds = [];

    // 60% have at least one collection
    if (Math.random() < 0.6) {
      const numCollections = Math.random() < 0.7 ? 1 : Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numCollections; j++) {
        const col = randomItem(collections);
        if (!collectionIds.includes(col.id)) {
          collectionIds.push(col.id);
        }
      }
    }

    // 30% have a nest
    if (Math.random() < 0.3 && nests.length > 0) {
      nestIds.push(randomItem(nests).id);
    }

    wings.push(generateWing(collectionIds, nestIds));
  }

  // Generate highlights (on random wings)
  const highlights = [];
  const wingsWithHighlights = wings.slice(0, Math.min(10, wings.length));
  for (let i = 0; i < highlightCount; i++) {
    const wing = randomItem(wingsWithHighlights);
    highlights.push(generateHighlight(wing.id));
  }

  // Generate connections (between random wing pairs)
  const connections = [];
  for (let i = 0; i < connectionCount && wings.length > 1; i++) {
    const wing1 = wings[i % wings.length];
    const wing2 = wings[(i + 1 + Math.floor(Math.random() * 10)) % wings.length];
    if (wing1.id !== wing2.id) {
      connections.push(generateConnection(wing1.id, wing2.id, 0.3 + Math.random() * 0.7));
    }
  }

  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    data: {
      wings,
      collections,
      nests,
      highlights,
      connections,
    },
    stats: {
      wings: wings.length,
      collections: collections.length,
      nests: nests.length,
      highlights: highlights.length,
      connections: connections.length,
    }
  };
}

// Generate and save test data
const testData = generateTestData({
  wingCount: 55,
  collectionCount: 6,
  nestCount: 8,
  highlightCount: 15,
  connectionCount: 20,
});

const outputPath = path.join(__dirname, 'wing-test-data.json');
fs.writeFileSync(outputPath, JSON.stringify(testData, null, 2));

console.log('Test data generated successfully!');
console.log(`File: ${outputPath}`);
console.log('Stats:', testData.stats);
console.log('\nTo use this data:');
console.log('1. Open the Wing extension options page');
console.log('2. Click "Import Data"');
console.log('3. Select the generated JSON file');
console.log('4. Choose "Replace" or "Merge" as needed');

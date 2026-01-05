export const REAL_WORLD_CERTS_CATALOG = [
    {
        id: 'COURSE_001',
        title: 'Foundational Self-Reliance',
        price: 49.99,
        category: 'Survival',
        url: 'https://www.realworldcerts.com/courses/foundational-self-reliance',
        description: 'Master the basics of survival: water, fire, shelter, and food.'
    },
    {
        id: 'COURSE_002',
        title: 'Ancestral Skills Level 1',
        price: 99.99,
        category: 'Primitive Skills',
        url: 'https://www.realworldcerts.com/courses/ancestral-skills-1',
        description: 'Learn the ancient ways: flintknapping, tracking, and natural navigation.'
    },
    {
        id: 'COURSE_003',
        title: 'Digital Illustration Mastery',
        price: 39.99,
        category: 'Creative',
        url: 'https://www.realworldcerts.com/courses/digital-illustration',
        description: 'From sketch to pro: complete guide to digital art.'
    },
    {
        id: 'COURSE_004',
        title: 'AI Prompt Engineering',
        price: 149.99,
        category: 'Tech',
        url: 'https://www.realworldcerts.com/courses/ai-prompt-engineering',
        description: 'Control the AI: advanced techniques for LLM prompting.'
    },
    {
        id: 'COURSE_005',
        title: 'Survival & Bushcraft Fundamentals',
        price: 79.99,
        category: 'Survival',
        url: 'https://www.realworldcerts.com/courses/bushcraft-fundamentals',
        description: 'Essential bushcraft skills for the modern outdoorsman.'
    }
];

export function getProductById(id) {
    return REAL_WORLD_CERTS_CATALOG.find(p => p.id === id);
}

export function getRandomProduct() {
    return REAL_WORLD_CERTS_CATALOG[Math.floor(Math.random() * REAL_WORLD_CERTS_CATALOG.length)];
}

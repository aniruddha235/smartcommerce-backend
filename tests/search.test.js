const request = require('supertest');

// Mock OpenAI SDK before importing server
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    matchingIds: [1],
                    explanation: "Mocked match for test query"
                  })
                }
              }
            ]
          })
        }
      }
    }))
  };
});

const app = require('../server');

describe('POST /api/search - AI Search Endpoint', () => {

  test('Should return 400 Bad Request if query field is missing', async () => {
    const response = await request(app)
      .post('/api/search')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error', 'Search query is required');
  });

  test('Should return mocked AI search response on valid query', async () => {
    const response = await request(app)
      .post('/api/search')
      .send({ query: 'backpack' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('explanation');
    expect(response.body.products.length).toBeGreaterThan(0);
    expect(response.body.products[0].id).toBe(1);
  });

});
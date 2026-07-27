jest.mock('../src/models/User', () => ({
  find: jest.fn().mockResolvedValue([
    { _id: 'officerId1' },
    { _id: 'officerId2' },
  ]),
}));

jest.mock('../src/models/Complaint', () => {
  return jest.fn().mockImplementation(() => ({
    save: jest.fn().mockResolvedValue(),
  }));
});

jest.mock('../src/services/notification.service', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
}));

const { createComplaint } = require('../src/services/complaint.service');
const { createNotification } = require('../src/services/notification.service');

test('createComplaint sends notification to each officer', async () => {
  const residentId = 'residentId';
  const data = { title: 'Test', description: 'Test description', type: 'illegal_dumping' };
  await createComplaint(residentId, data);
  expect(createNotification).toHaveBeenCalledTimes(2);
  expect(createNotification).toHaveBeenCalledWith(
    expect.objectContaining({ user: 'officerId1', type: 'complaint_update' })
  );
  expect(createNotification).toHaveBeenCalledWith(
    expect.objectContaining({ user: 'officerId2', type: 'complaint_update' })
  );
});

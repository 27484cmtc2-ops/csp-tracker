const mockInsert = jest.fn();
const mockGetUser = jest.fn();
const mockFrom = jest.fn();

jest.mock("./supabaseClient", () => ({
  supabase: {
    auth: { getUser: (...args) => mockGetUser(...args) },
    from: (...args) => mockFrom(...args),
  },
}));

import { APP_VERSION, submitFeedback } from "./feedbackStorage";

beforeEach(() => {
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockFrom.mockReset().mockReturnValue({ insert: (...args) => mockInsert(...args) });
  mockGetUser.mockReset().mockResolvedValue({
    data: { user: { id: "user-123" } },
    error: null,
  });
});

test("stores only beta feedback fields with authenticated user and app metadata", async () => {
  await submitFeedback({
    category: "feature_request",
    message: "  Add a monthly income view.  ",
    email: "  trader@example.com  ",
  });

  expect(mockInsert).toHaveBeenCalledWith({
    user_id: "user-123",
    email: "trader@example.com",
    category: "feature_request",
    message: "Add a monthly income view.",
    app_version: APP_VERSION,
  });
  expect(mockInsert.mock.calls[0][0]).not.toHaveProperty("trades");
  expect(mockInsert.mock.calls[0][0]).not.toHaveProperty("target");
});

test("does not submit feedback without an authenticated user", async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

  await expect(submitFeedback({ category: "bug", message: "Issue", email: "" }))
    .rejects.toThrow("You must be signed in");
  expect(mockInsert).not.toHaveBeenCalled();
});

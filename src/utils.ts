import { ErrorWithStatusCode } from "./errors";

export function sendingErrorData(err: ErrorWithStatusCode): {
  message: string
  name: string
  stack: string
  status: number
} {
  return {
    message: err.message,
    name: err.name,
    stack: err.stack,
    status: err.status || 500
  }
}

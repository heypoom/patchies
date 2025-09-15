import { CanvasError } from "machine-wasm"

export const ErrorIndicator = ({ error }: { error: CanvasError }) => {
  const { type } = error

  if (type === "DisconnectedPort") {
    const { port } = error.port

    return (
      <pre>
        Port {port} is disconnected. Make sure port {port} is wired to another
        block.
      </pre>
    )
  }

  if (type === "MachineError") {
    const { cause } = error
    const reason = cause.type

    if (reason === "ExecutionCycleExceeded") {
      return <pre>Your program exceeds the execution cycle quota.</pre>
    }

    if (reason === "MessageNeverReceived") {
      return (
        <pre className="text-purple-11">
          Machine is waiting for a message which never arrives.
        </pre>
      )
    }

    if (reason === "ExecutionFailed") {
      return (
        <pre>
          Your program produced a runtime error:{" "}
          <strong>
            <code>{JSON.stringify(cause.error, null, 2)}</code>
          </strong>
        </pre>
      )
    }

    if (reason === "CannotParse") {
      // The user has not written any program yet.
      // We do not consider this as an error.
      if (cause.error.type === "EmptyProgram") return null

      return (
        <pre>
          Syntax is incorrect:{" "}
          <strong>
            <code>{JSON.stringify(cause.error, null, 2)}</code>
          </strong>
        </pre>
      )
    }
  }

  return <pre>{JSON.stringify(error, null, 2)}</pre>
}

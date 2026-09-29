import { Component } from 'react'

/**
 * Keeps a render failure in one panel from blanking the whole app. Shows what
 * broke and offers a reset, rather than a white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <h2>Something broke</h2>
        <p className="msg">{String(this.state.error?.message || this.state.error)}</p>
        <button onClick={() => this.setState({ error: null })}>Try again</button>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }
}

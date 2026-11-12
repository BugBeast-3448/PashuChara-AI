import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import ErrorState from '../components/ErrorState'
import Button from '../components/Button'
import { ROUTES } from '../constants/routes'

/**
 * Fallback error boundary rendered by React Router when a route throws.
 */
function RouteErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.statusText || 'Unable to load this page.'
    : error?.message || 'An unexpected error occurred. Please try again.'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf7f0] dark:bg-[#0a0c0b] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#161c18] border border-[#ded5c2] dark:border-[#242824] shadow-xl">
        <ErrorState
          title="Something went wrong"
          description={message}
          action={
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reload App
              </Button>
              <Button variant="primary" onClick={() => window.location.assign(ROUTES.HOME)}>
                Go Home
              </Button>
            </div>
          }
        />
      </div>
    </div>
  )
}

export default RouteErrorPage


import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/quiz/')({
  component: QuizIndexPage,
})

function QuizIndexPage() {
  return <Navigate to="/quiz/all" />
}

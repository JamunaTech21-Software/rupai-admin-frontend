import { Navigate, useParams } from 'react-router';

/** /workforce/profiles/:id/assignments: the profile page with its Assignments tab open. */
export function ProfileAssignmentsPage() {
  const { id } = useParams();
  return <Navigate to={`/workforce/profiles/${id ?? ''}?tab=assignments`} replace />;
}

export { ProfileAssignmentsPage as Component };

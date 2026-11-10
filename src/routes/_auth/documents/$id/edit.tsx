import { createFileRoute } from "@tanstack/react-router";

import FieldEditor from "@/components/signet/FieldEditor";
import createMetaTags from "@/lib/util/createMetaTags";

export const Route = createFileRoute("/_auth/documents/$id/edit")({
  head: () => ({ meta: createMetaTags({ title: "Edit document" }) }),
  component: EditDocumentPage,
});

function EditDocumentPage() {
  const { id } = Route.useParams();
  return <FieldEditor token={id} />;
}

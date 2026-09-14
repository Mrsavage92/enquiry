import type { Business, KnowledgeItem } from "@/domain/types";

export function businessSectionPreview(business: Business, section: KnowledgeItem["section"]) {
  const items = business.knowledge.filter(
    (item) => item.businessId === business.id && item.section === section,
  );
  const active = items.filter((item) => item.state === "Active");
  const names =
    section === "service"
      ? business.services
          .filter((service) => service.state === "Active")
          .map((service) => service.customerLabel)
      : active.map((item) => item.title);
  const titles = [...new Set(names)];
  const preview = titles.length
    ? `${titles.slice(0, 2).join(" · ")}${titles.length > 2 ? ` +${titles.length - 2} more` : ""}`
    : section === "capacity"
      ? "No active capacity rules"
      : "No active details saved";
  return {
    preview,
    needsReview:
      items.filter((item) => item.state === "Needs review").length +
      (section === "service"
        ? business.services.filter((service) => service.state === "Needs review").length
        : 0),
  };
}

export function visibleBusinessServices(business: Business | undefined, query: string) {
  const search = query.trim().toLowerCase();
  return (business?.services ?? []).filter((service) =>
    [service.name, service.customerLabel, service.category, ...service.locationModes].some(
      (value) => value.toLowerCase().includes(search),
    ),
  );
}

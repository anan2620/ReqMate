import { useEffect, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { useEnvironmentStore } from "@/stores/environment-store";
import { useCollectionStore } from "@/stores/collection-store";
import { Select } from "@/components/ui/select";

export const EnvironmentSelector = forwardRef<HTMLButtonElement>(
  function EnvironmentSelector(_props, ref) {
    const { t } = useTranslation();
    const { environments, activeEnvironmentName, setActiveEnvironment, loadEnvironments } =
      useEnvironmentStore();
    const { collections } = useCollectionStore();

    // Load environments when collections change
    useEffect(() => {
      if (collections.length > 0) {
        const firstCollection = collections[0];
        if (firstCollection.type === "collection") {
          loadEnvironments(firstCollection.path);
        }
      }
    }, [collections, loadEnvironments]);

    if (environments.length === 0) {
      return (
        <p className="text-xs text-[var(--color-text-dimmed)]">
          {t("environment.noEnvironments")}
        </p>
      );
    }

    return (
      <Select
        triggerRef={ref}
        data-tour="environment"
        value={activeEnvironmentName ?? ""}
        onChange={(value) => setActiveEnvironment(value || null)}
        options={[
          { value: "", label: t("environment.noEnvironment") },
          ...environments.map((env) => ({ value: env.name, label: env.name })),
        ]}
        aria-label={t("environment.noEnvironment")}
      />
    );
  },
);

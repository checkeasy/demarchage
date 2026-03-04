interface TemplateData {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  website?: string | null;
  location?: string | null;
  [key: string]: string | null | undefined;
}

// French aliases for template variables
const VARIABLE_ALIASES: Record<string, string> = {
  prenom: "firstName",
  nom: "lastName",
  entreprise: "company",
  poste: "jobTitle",
};

/**
 * Replace template variables in text.
 * Supports: {firstName}, {lastName}, {company}, {jobTitle}, {email}, etc.
 * Also supports French aliases: {prenom}, {nom}, {entreprise}, {poste}
 * Also supports conditionals: {#if company}at {company}{/if}
 */
export function mergeTemplate(
  template: string,
  data: TemplateData
): string {
  let result = template;

  // Handle conditional blocks: {#if varName}...content...{/if}
  result = result.replace(
    /\{#if\s+(\w+)\}([\s\S]*?)\{\/if\}/g,
    (_match, varName: string, content: string) => {
      const resolvedName = VARIABLE_ALIASES[varName] || varName;
      const value = data[resolvedName];
      if (value && value.trim() !== "") {
        return mergeTemplate(content, data);
      }
      return "";
    }
  );

  // Replace simple variables: {variableName}
  result = result.replace(/\{(\w+)\}/g, (_match, varName: string) => {
    const resolvedName = VARIABLE_ALIASES[varName] || varName;
    const value = data[resolvedName];
    return value ?? "";
  });

  // Clean up artifacts from empty variables:
  // - Leading comma+space: ", le piege" -> "Le piege"
  // - Double spaces
  // - Leading/trailing whitespace
  result = result.replace(/^[\s,]+/, ""); // leading commas/spaces
  result = result.replace(/\s{2,}/g, " "); // double spaces
  result = result.trim();

  // Capitalize first letter if it was lowered after cleanup
  if (result.length > 0 && result[0] !== result[0].toUpperCase() && /^[a-zàâäéèêëïîôùûüÿç]/.test(result)) {
    result = result[0].toUpperCase() + result.slice(1);
  }

  return result;
}

/**
 * Convert a prospect record to template data
 */
export function prospectToTemplateData(prospect: {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  job_title?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  website?: string | null;
  location?: string | null;
  custom_fields?: Record<string, string> | null;
}): TemplateData {
  const data: TemplateData = {
    firstName: prospect.first_name,
    lastName: prospect.last_name,
    company: prospect.company,
    jobTitle: prospect.job_title,
    email: prospect.email,
    phone: prospect.phone,
    linkedinUrl: prospect.linkedin_url,
    website: prospect.website,
    location: prospect.location,
  };

  // Add custom fields
  if (prospect.custom_fields) {
    for (const [key, value] of Object.entries(prospect.custom_fields)) {
      data[key] = value;
    }
  }

  return data;
}

/**
 * Get all variable names used in a template
 */
export function extractTemplateVariables(template: string): string[] {
  const variables = new Set<string>();

  // Match {variableName} (excluding conditional syntax)
  const simpleMatches = template.matchAll(/\{(\w+)\}/g);
  for (const match of simpleMatches) {
    if (!["#if", "/if"].includes(match[1])) {
      variables.add(match[1]);
    }
  }

  // Match variables inside conditionals
  const conditionalMatches = template.matchAll(/\{#if\s+(\w+)\}/g);
  for (const match of conditionalMatches) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

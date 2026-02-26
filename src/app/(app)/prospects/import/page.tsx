"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Papa from "papaparse";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { prospectSchema } from "@/lib/validations";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PROSPECT_FIELDS = [
  { key: "email", label: "Email", required: true },
  { key: "first_name", label: "Prenom", required: false },
  { key: "last_name", label: "Nom", required: false },
  { key: "company", label: "Entreprise", required: false },
  { key: "job_title", label: "Poste", required: false },
  { key: "phone", label: "Telephone", required: false },
  { key: "linkedin_url", label: "URL LinkedIn", required: false },
  { key: "website", label: "Site web", required: false },
  { key: "location", label: "Localisation", required: false },
] as const;

type ProspectField = (typeof PROSPECT_FIELDS)[number]["key"];

interface ParsedRow {
  [key: string]: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

export default function ImportProspectsPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<
    Record<string, ProspectField | "ignore">
  >({});
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<
    { row: ParsedRow; error: string }[]
  >([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Step 1 - File upload
  function handleFile(f: File) {
    if (!f.name.endsWith(".csv")) {
      toast.error("Veuillez selectionner un fichier CSV");
      return;
    }

    setFile(f);

    Papa.parse<ParsedRow>(f, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields ?? [];
        setCsvHeaders(headers);
        setCsvRows(results.data);

        // Auto-map columns by matching names
        const autoMapping: Record<string, ProspectField | "ignore"> = {};
        headers.forEach((header) => {
          const normalized = header.toLowerCase().trim();
          const match = PROSPECT_FIELDS.find((field) => {
            const fieldLower = field.key.toLowerCase();
            const labelLower = field.label.toLowerCase();
            return (
              normalized === fieldLower ||
              normalized === labelLower ||
              normalized.includes(fieldLower) ||
              normalized === fieldLower.replace("_", " ") ||
              // Common CSV header names
              (fieldLower === "email" && normalized.includes("email")) ||
              (fieldLower === "first_name" &&
                (normalized.includes("prenom") ||
                  normalized.includes("first"))) ||
              (fieldLower === "last_name" &&
                ((normalized.includes("nom") && !normalized.includes("prenom")) ||
                  normalized.includes("last"))) ||
              (fieldLower === "company" &&
                (normalized.includes("entreprise") ||
                  normalized.includes("societe") ||
                  normalized.includes("company"))) ||
              (fieldLower === "job_title" &&
                (normalized.includes("poste") ||
                  normalized.includes("titre") ||
                  normalized.includes("title") ||
                  normalized.includes("fonction"))) ||
              (fieldLower === "phone" &&
                (normalized.includes("telephone") ||
                  normalized.includes("tel") ||
                  normalized.includes("phone"))) ||
              (fieldLower === "linkedin_url" &&
                normalized.includes("linkedin")) ||
              (fieldLower === "website" &&
                (normalized.includes("site") ||
                  normalized.includes("website") ||
                  normalized.includes("url"))) ||
              (fieldLower === "location" &&
                (normalized.includes("ville") ||
                  normalized.includes("lieu") ||
                  normalized.includes("location") ||
                  normalized.includes("localisation")))
            );
          });
          autoMapping[header] = match ? match.key : "ignore";
        });
        setColumnMapping(autoMapping);
        setStep(2);
      },
      error() {
        toast.error("Erreur lors de la lecture du fichier CSV");
      },
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  // Step 2 -> Step 3: Validate mapping and preview
  function validateAndPreview() {
    // Check that email is mapped
    const emailMapped = Object.values(columnMapping).includes("email");
    if (!emailMapped) {
      toast.error("Vous devez associer au moins la colonne email");
      return;
    }

    // Build reverse mapping: prospect field -> CSV header
    const reverseMap: Record<string, string> = {};
    for (const [csvHeader, prospectField] of Object.entries(columnMapping)) {
      if (prospectField !== "ignore") {
        reverseMap[prospectField] = csvHeader;
      }
    }

    const valid: ParsedRow[] = [];
    const invalid: { row: ParsedRow; error: string }[] = [];
    const seenEmails = new Set<string>();
    let dupes = 0;

    for (const row of csvRows) {
      // Map CSV row to prospect fields
      const mappedRow: Record<string, string> = {};
      for (const [field, csvHeader] of Object.entries(reverseMap)) {
        mappedRow[field] = row[csvHeader]?.trim() ?? "";
      }

      // Validate with Zod
      const result = prospectSchema.safeParse(mappedRow);
      if (!result.success) {
        const firstError = result.error.issues[0]?.message ?? "Donnees invalides";
        invalid.push({ row: mappedRow, error: firstError });
        continue;
      }

      // Check duplicates within file
      const email = mappedRow.email?.toLowerCase();
      if (seenEmails.has(email)) {
        dupes++;
        continue;
      }
      seenEmails.add(email);
      valid.push(mappedRow);
    }

    setValidRows(valid);
    setInvalidRows(invalid);
    setDuplicateCount(dupes);
    setStep(3);
  }

  // Step 4: Import
  async function handleImport() {
    setIsImporting(true);
    setStep(4);

    // Get workspace_id
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Session expiree, veuillez vous reconnecter");
      setIsImporting(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("current_workspace_id")
      .eq("id", user.id)
      .single();

    const workspaceId = profile?.current_workspace_id;
    if (!workspaceId) {
      toast.error("Workspace non trouve");
      setIsImporting(false);
      return;
    }

    try {
      const response = await fetch("/api/prospects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospects: validRows,
          workspace_id: workspaceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erreur lors de l'import");
        setIsImporting(false);
        return;
      }

      setImportResult(data);
      toast.success(`${data.imported} prospect(s) importe(s) avec succes`);
    } catch {
      toast.error("Erreur lors de l'import");
    }

    setIsImporting(false);
  }

  // Step indicators
  const steps = [
    { number: 1, label: "Fichier" },
    { number: 2, label: "Mapping" },
    { number: 3, label: "Apercu" },
    { number: 4, label: "Import" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/prospects">
            <ArrowLeft className="size-4" />
            Retour aux prospects
          </Link>
        </Button>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-900">Importer des prospects</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Importez vos prospects depuis un fichier CSV
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, index) => (
          <div key={s.number} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center size-8 rounded-full text-sm font-medium ${
                step >= s.number
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-100 text-muted-foreground"
              }`}
            >
              {step > s.number ? (
                <CheckCircle2 className="size-4" />
              ) : (
                s.number
              )}
            </div>
            <span
              className={`text-sm ${
                step >= s.number
                  ? "font-medium text-slate-900"
                  : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {index < steps.length - 1 && (
              <ChevronRight className="size-4 text-muted-foreground mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: File Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Selectionner un fichier CSV</CardTitle>
            <CardDescription>
              Glissez-deposez votre fichier ou cliquez pour le selectionner.
              Le fichier doit contenir au minimum une colonne email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
              <Upload className="size-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-900">
                Glissez votre fichier CSV ici
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ou cliquez pour parcourir vos fichiers
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Associer les colonnes</CardTitle>
            <CardDescription>
              Associez chaque colonne de votre CSV aux champs prospect.
              {file && (
                <span className="flex items-center gap-2 mt-2">
                  <FileSpreadsheet className="size-4" />
                  {file.name} - {csvRows.length} lignes detectees
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Column mapping */}
            <div className="space-y-3">
              {csvHeaders.map((header) => (
                <div
                  key={header}
                  className="flex items-center gap-4"
                >
                  <div className="w-1/3">
                    <p className="text-sm font-medium truncate">{header}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {csvRows[0]?.[header] ?? "-"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  <div className="w-1/3">
                    <Select
                      value={columnMapping[header] ?? "ignore"}
                      onValueChange={(value) =>
                        setColumnMapping((prev) => ({
                          ...prev,
                          [header]: value as ProspectField | "ignore",
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ignore">-- Ignorer --</SelectItem>
                        {PROSPECT_FIELDS.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {field.label}
                            {field.required ? " *" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {/* Preview first 5 rows */}
            {csvRows.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Apercu des 5 premieres lignes :
                </p>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {csvHeaders.map((h) => (
                          <TableHead key={h} className="text-xs">
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvRows.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          {csvHeaders.map((h) => (
                            <TableCell key={h} className="text-xs">
                              {row[h] || "-"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="size-4" />
                Retour
              </Button>
              <Button onClick={validateAndPreview}>
                Valider le mapping
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Apercu de l&apos;import</CardTitle>
            <CardDescription>
              Verifiez les donnees avant de lancer l&apos;import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">
                  {csvRows.length}
                </p>
                <p className="text-xs text-muted-foreground">Total lignes</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700">
                  {validRows.length}
                </p>
                <p className="text-xs text-green-600">Valides</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">
                  {duplicateCount}
                </p>
                <p className="text-xs text-amber-600">Doublons</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-700">
                  {invalidRows.length}
                </p>
                <p className="text-xs text-red-600">Erreurs</p>
              </div>
            </div>

            {/* Valid rows preview */}
            {validRows.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Prospects valides (5 premiers) :
                </p>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Prenom</TableHead>
                        <TableHead className="text-xs">Nom</TableHead>
                        <TableHead className="text-xs">Entreprise</TableHead>
                        <TableHead className="text-xs">Poste</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">
                            {row.email}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.first_name || "-"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.last_name || "-"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.company || "-"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.job_title || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Errors preview */}
            {invalidRows.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 text-red-600">
                  Lignes en erreur :
                </p>
                <div className="border border-red-200 rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Erreur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalidRows.slice(0, 10).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">
                            {item.row.email || "(vide)"}
                          </TableCell>
                          <TableCell className="text-xs text-red-600">
                            {item.error}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="size-4" />
                Retour
              </Button>
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0}
              >
                Importer {validRows.length} prospect(s)
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Import Progress / Results */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isImporting ? "Import en cours..." : "Import termine"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isImporting ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="size-12 text-primary animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">
                  Import de {validRows.length} prospects en cours...
                </p>
              </div>
            ) : importResult ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle2 className="size-16 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold">
                    Import termine avec succes
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold">{importResult.total}</p>
                    <p className="text-xs text-muted-foreground">Total traites</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-700">
                      {importResult.imported}
                    </p>
                    <p className="text-xs text-green-600">Importes</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {importResult.skipped}
                    </p>
                    <p className="text-xs text-amber-600">Ignores</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-700">
                      {importResult.errors}
                    </p>
                    <p className="text-xs text-red-600">Erreurs</p>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <Button variant="outline" asChild>
                    <Link href="/prospects">Voir les prospects</Link>
                  </Button>
                  <Button
                    onClick={() => {
                      setStep(1);
                      setFile(null);
                      setCsvHeaders([]);
                      setCsvRows([]);
                      setColumnMapping({});
                      setValidRows([]);
                      setInvalidRows([]);
                      setDuplicateCount(0);
                      setImportResult(null);
                    }}
                  >
                    Importer un autre fichier
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="size-12 text-red-500 mb-4" />
                <p className="text-sm text-muted-foreground">
                  Une erreur est survenue. Veuillez reessayer.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setStep(3)}
                >
                  Retour
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

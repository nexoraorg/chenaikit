import {
  generateFilename,
  formatMetadata,
  exportToCSV,
  exportToJSON,
  exportToExcel,
  ExportMetadata,
} from "../exportUtils";

describe("exportUtils", () => {
  describe("generateFilename", () => {
    it("should generate filename with timestamp", () => {
      const filename = generateFilename("test", "csv");
      expect(filename).toMatch(
        /^test_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv$/,
      );
    });

    it("should include metadata in filename", () => {
      const metadata: ExportMetadata = {
        exportDate: new Date("2024-01-15"),
        source: "Test Dashboard",
      };
      const filename = generateFilename("dashboard", "pdf", metadata);
      expect(filename).toMatch(
        /^dashboard_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.pdf$/,
      );
    });
  });

  describe("formatMetadata", () => {
    it("should format metadata correctly", () => {
      const metadata: ExportMetadata = {
        exportDate: new Date("2024-01-15T10:30:00"),
        source: "Analytics Dashboard",
      };

      const formatted = formatMetadata(metadata);
      expect(formatted["Source"]).toBe("Analytics Dashboard");
      expect(formatted["Export Date"]).toBeDefined();
    });

    it("should include date range when provided", () => {
      const metadata: ExportMetadata = {
        exportDate: new Date(),
        source: "Dashboard",
        dateRange: {
          start: new Date("2024-01-01"),
          end: new Date("2024-01-31"),
        },
      };

      const formatted = formatMetadata(metadata);
      expect(formatted["Date Range Start"]).toBeDefined();
      expect(formatted["Date Range End"]).toBeDefined();
    });

    it("should include filters when provided", () => {
      const metadata: ExportMetadata = {
        exportDate: new Date(),
        source: "Dashboard",
        filters: { timeRange: "30 days", status: "active" },
      };

      const formatted = formatMetadata(metadata);
      expect(formatted["Filters Applied"]).toContain("timeRange");
      expect(formatted["Filters Applied"]).toContain("30 days");
    });

    it("should return empty object when no metadata provided", () => {
      const formatted = formatMetadata(undefined);
      expect(formatted).toEqual({});
    });
  });

  describe("exportToCSV", () => {
    let createElementSpy: jest.SpyInstance;
    let appendChildSpy: jest.SpyInstance;
    let removeChildSpy: jest.SpyInstance;
    let clickSpy: jest.Mock;

    beforeEach(() => {
      clickSpy = jest.fn();
      const mockElement = {
        setAttribute: jest.fn(),
        style: { visibility: "" },
        click: clickSpy,
      };

      createElementSpy = jest
        .spyOn(document, "createElement")
        .mockReturnValue(mockElement as any);
      appendChildSpy = jest
        .spyOn(document.body, "appendChild")
        .mockReturnValue(mockElement as any);
      removeChildSpy = jest
        .spyOn(document.body, "removeChild")
        .mockReturnValue(mockElement as any);

      global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    });

    afterEach(() => {
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it("should export data to CSV", () => {
      const data = [
        { name: "Alice", age: 30, city: "NYC" },
        { name: "Bob", age: 25, city: "LA" },
      ];

      exportToCSV(data);

      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(clickSpy).toHaveBeenCalled();
    });

    it("should include metadata in CSV export", () => {
      const data = [{ metric: "sales", value: 100 }];
      const metadata: ExportMetadata = {
        exportDate: new Date(),
        source: "Sales Dashboard",
      };

      exportToCSV(data, { metadata });

      expect(clickSpy).toHaveBeenCalled();
    });

    it("should handle empty data", () => {
      expect(() => exportToCSV([])).toThrow("No data to export");
    });

    it("should call progress callback", () => {
      const onProgress = jest.fn();
      const data = [{ a: 1 }, { a: 2 }];

      exportToCSV(data, { onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(100);
    });
  });

  describe("exportToJSON", () => {
    let createElementSpy: jest.SpyInstance;
    let clickSpy: jest.Mock;

    beforeEach(() => {
      clickSpy = jest.fn();
      const mockElement = {
        setAttribute: jest.fn(),
        style: { visibility: "" },
        click: clickSpy,
      };

      createElementSpy = jest
        .spyOn(document, "createElement")
        .mockReturnValue(mockElement as any);
      jest
        .spyOn(document.body, "appendChild")
        .mockReturnValue(mockElement as any);
      jest
        .spyOn(document.body, "removeChild")
        .mockReturnValue(mockElement as any);

      global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    });

    afterEach(() => {
      createElementSpy.mockRestore();
    });

    it("should export data to JSON", () => {
      const data = { users: [{ name: "Alice" }], count: 1 };

      exportToJSON(data);

      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(clickSpy).toHaveBeenCalled();
    });

    it("should call progress callback", () => {
      const onProgress = jest.fn();
      const data = { test: true };

      exportToJSON(data, { onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(100);
    });
  });

  describe("exportToExcel", () => {
    let createElementSpy: jest.SpyInstance;
    let clickSpy: jest.Mock;

    beforeEach(() => {
      clickSpy = jest.fn();
      const mockElement = {
        setAttribute: jest.fn(),
        style: { visibility: "" },
        click: clickSpy,
      };

      createElementSpy = jest
        .spyOn(document, "createElement")
        .mockReturnValue(mockElement as any);
      jest
        .spyOn(document.body, "appendChild")
        .mockReturnValue(mockElement as any);
      jest
        .spyOn(document.body, "removeChild")
        .mockReturnValue(mockElement as any);

      global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    });

    afterEach(() => {
      createElementSpy.mockRestore();
    });

    it("should export data to Excel", () => {
      const data = [
        { product: "Widget", price: 10 },
        { product: "Gadget", price: 20 },
      ];

      exportToExcel(data);

      expect(createElementSpy).toHaveBeenCalledWith("a");
      expect(clickSpy).toHaveBeenCalled();
    });

    it("should use custom sheet name", () => {
      const data = [{ a: 1 }];

      exportToExcel(data, { sheetName: "CustomSheet" });

      expect(clickSpy).toHaveBeenCalled();
    });

    it("should call progress callback", () => {
      const onProgress = jest.fn();
      const data = [{ x: 1 }];

      exportToExcel(data, { onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(100);
    });
  });
});

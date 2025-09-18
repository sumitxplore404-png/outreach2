# TODO: Add Excel Support & Row Range Selection

## Features to Implement

### 1. Excel File Support (.xlsx, .xls)
- [ ] Install `xlsx` library for Excel file parsing
- [ ] Update file validation in `components/upload-batch-section.tsx` to accept Excel files
- [ ] Modify `app/api/batch/process/route.ts` to handle Excel files
- [ ] Add Excel parsing logic similar to CSV parsing
- [ ] Update UI to show supported file types (.csv, .xlsx, .xls)

### 2. Row Range Selection Feature
- [ ] Add row range input UI in `components/upload-batch-section.tsx`
- [ ] Show total row count after file processing
- [ ] Allow users to input ranges like "100-200, 300-450"
- [ ] Validate range inputs (must be within available rows)
- [ ] Filter contacts based on selected ranges before email generation
- [ ] Update batch processing to handle row filtering

### 3. Performance Optimization
- [ ] Implement efficient Excel parsing for large files
- [ ] Add progress indicators for large file processing
- [ ] Optimize memory usage when processing large datasets
- [ ] Add file size limits for Excel files

### 4. UI/UX Improvements
- [ ] Update file upload UI to show supported formats
- [ ] Add row count display after file processing
- [ ] Add range selection input with validation
- [ ] Show preview of selected ranges
- [ ] Update help text and examples

## Files to Modify

### Frontend
- `components/upload-batch-section.tsx` - File validation, UI for range selection
- `app/dashboard/page.tsx` - State management for ranges

### Backend
- `app/api/batch/process/route.ts` - Excel parsing, range filtering
- `package.json` - Add xlsx dependency

## Implementation Steps

1. Install xlsx library
2. Update file validation to accept Excel files
3. Add Excel parsing logic to batch process route
4. Add row range selection UI
5. Implement range validation and filtering
6. Test with various file formats and sizes
7. Update documentation and help text

## Testing Scenarios

- CSV files (existing functionality)
- Excel files (.xlsx, .xls)
- Large files (1000+ rows)
- Row range selection (single range, multiple ranges)
- Invalid ranges (out of bounds, overlapping)
- Mixed valid/invalid data in Excel files

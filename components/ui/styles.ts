export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const ui = {
  page: "mx-auto max-w-[1600px] px-4 py-6 min-[600px]:px-5 min-[600px]:pt-7 min-[600px]:pb-10 lg:p-8",
  pageHeading: "mb-5 flex flex-col gap-[18px] [&_h1]:text-[18px] [&_h1]:font-semibold [&_h1]:leading-[1.4] [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:leading-[1.4] min-[1200px]:flex-row min-[1200px]:items-end min-[1200px]:justify-between min-[1200px]:[&>div:first-child]:min-w-0 min-[1200px]:[&>[data-slot=toolbar]]:w-max min-[1200px]:[&>[data-slot=toolbar]]:shrink-0 min-[1200px]:[&>[data-slot=toolbar]]:flex-nowrap min-[1200px]:[&>[data-slot=toolbar]_[data-slot=field]:has(input[type=search])]:w-[290px] min-[1200px]:[&>[data-slot=toolbar]_[data-slot=field]:has(input[type=search])]:shrink-0",
  eyebrow: "mb-3 text-xs/normal font-semibold text-navy",
  pageDescription: "mt-[5px] text-sm leading-normal text-muted",
  toolbar: "flex flex-wrap items-end gap-2 max-[600px]:gap-2.5 [&_[data-slot=field]]:text-xs/normal [&_[data-slot=field]]:text-muted [&_[data-slot=input]]:h-[38px] [&_[data-slot=input]]:min-h-[38px] [&_[data-slot=input]]:border-line max-[600px]:[&_[data-slot=input]]:min-h-11 [&_select]:w-[130px] [&_input[type=date]]:w-[145px] [&_[data-slot=field]:has(input[type=search])]:w-[min(290px,100%)] max-[600px]:[&_[data-slot=field]:has(input[type=search])]:w-full",
  field: "flex min-w-0 flex-col gap-1.5 text-[#444] max-[600px]:has-[input[type=checkbox]]:min-h-11",
  input: "min-h-10 w-full rounded-lg border border-[#d6d6d6] bg-white px-3 py-2 text-sm/normal text-[#333]",
  panel: "min-w-0 rounded-2xl border border-line bg-white p-6 shadow-[0_1px_2px_#14264126] max-[600px]:p-[18px] [&_h2]:text-base [&_h2]:font-semibold",
  panelHeading: "mb-5 flex items-start justify-between gap-4",
  panelDescription: "mt-[3px] text-xs leading-[1.4] text-muted",
  statGrid: "mt-[38px] mb-7 grid grid-cols-1 gap-[18px] max-[600px]:mt-6 min-[600px]:grid-cols-2 min-[1200px]:grid-cols-4",
  summaryGrid: "mt-5 mb-3.5 grid grid-cols-1 gap-[18px] min-[600px]:grid-cols-2 min-[700px]:grid-cols-3",
  sectionHeading: "mb-5 flex flex-wrap items-end justify-between gap-4 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:leading-[1.4]",
  chartPanel: "overflow-hidden rounded-[14px] border border-line [&_h3]:px-5 [&_h3]:pt-6 [&_h3]:pb-4 [&_h3]:text-base [&_h3]:font-semibold",
  emptyState: "px-6 py-12 text-center text-muted",
  error: "mb-[18px] rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700",
  tabs: "my-5 flex gap-1 rounded-[10px] border border-[#e3e3e3] bg-[#f8f9fa] p-[7px] shadow-[0_6px_22px_#0000000d] max-[600px]:flex-wrap [&>a]:flex-1 [&>button]:flex-1 [&>a]:rounded-[10px] [&>button]:rounded-[10px] [&>a]:px-2 [&>button]:px-2 [&>a]:py-2.5 [&>button]:py-2.5 [&>a]:text-center [&>button]:text-center [&>a]:text-[#555] [&>button]:text-[#555] [&>[aria-current]]:bg-[#d2dcef] [&>[aria-current]]:text-navy [&>[aria-current]]:font-semibold [&>[aria-selected=true]]:bg-[#d2dcef] [&>[aria-selected=true]]:text-navy [&>[aria-selected=true]]:font-semibold max-[600px]:[&>a]:min-h-11 max-[600px]:[&>button]:min-h-11 max-[600px]:[&>a]:min-w-[90px] max-[600px]:[&>button]:min-w-[90px] max-[600px]:[&>a]:text-xs/normal max-[600px]:[&>button]:text-xs/normal",
  infoRow: "flex items-center justify-between gap-6 border-b border-dashed border-[#d9d9d9] py-2.5 last:border-b-0 last:pb-0 max-[600px]:gap-3 max-[600px]:text-xs/normal [&>:first-child]:shrink-0 [&>:first-child]:text-[#737373] [&>:last-child]:min-w-0 [&>:last-child]:text-right [&>:last-child]:font-semibold [&>:last-child]:text-[#383838] [&>:last-child]:[overflow-wrap:anywhere]",
  tableWrap: "min-h-[280px] overflow-x-auto rounded-t-xl",
  table: "w-full min-w-[760px] border-collapse text-left text-xs/normal [&_th]:bg-[#f0f4f8] [&_th]:px-5 [&_th]:py-[19px] [&_th]:font-semibold [&_th]:text-[#20232a] [&_td]:h-12 [&_td]:px-5 [&_td]:py-2 [&_td]:text-[#505050] [&_tbody_tr:nth-child(even)]:bg-[#f8f9fa] [&_tbody_tr[data-running=true]]:bg-[#edfaf5] [&_input[type=checkbox]]:size-4 [&_input[type=checkbox]]:align-middle [&_th_button]:flex [&_th_button]:w-full [&_th_button]:items-center [&_th_button]:justify-between [&_th_button]:gap-3",
  statusBadge: "inline-block rounded-[20px] bg-[#f0f4f8] px-2.5 py-1 text-[10px] font-semibold text-[#455b7a] uppercase data-[running=true]:bg-[#eafbf4] data-[running=true]:text-[#007b57]",
  rowMenu: "relative [&>summary]:grid [&>summary]:size-9 [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:place-items-center [&>summary]:rounded [&>summary]:border [&>summary]:border-line [&>summary]:bg-white [&>summary::-webkit-details-marker]:hidden max-[600px]:[&>summary]:size-11 [&>summary[data-slot=button]]:inline-flex [&>summary[data-slot=button]]:rounded-lg [&>summary[data-slot=button]]:border-navy",
  rowMenuContent: "absolute right-0 z-20 w-[150px] rounded-lg border border-line bg-white p-[5px] shadow-[0_3px_15px_#0002] [&>*]:block [&>*]:w-full [&>*]:rounded [&>*]:p-2.5 [&>*]:text-left [&>*:hover]:bg-[#f0f4f8]",
  modalBody: "px-6 py-5 max-[600px]:p-4 [&>[data-slot=tabs]:first-child]:mt-0",
  modalFooter: "flex justify-end gap-2 border-t border-[#e5e5e5] px-6 pt-4 pb-6 max-[600px]:p-4",
  formGrid: "grid gap-x-3 gap-y-3.5 min-[600px]:grid-cols-3",
  formSection: "border-t border-[#e5e5e5] px-6 py-[18px] max-[600px]:p-4 [&_h3]:mb-3.5 [&_h3]:font-semibold [&_h3]:text-[#444]",
} as const;

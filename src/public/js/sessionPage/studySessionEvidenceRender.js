// Rendering for evidence lists and upload forms.
function renderEvidenceList(evidenceList) {
  return evidenceList.length
    ? evidenceList.map(renderEvidenceItem).join('')
    : emptyText('No evidence uploaded yet.');
}

function renderEvidenceItem(item) {
  const type = item.content_type || 'equation';
  const url = item.url || item.image_url;
  const label = escapeHtml(
    item.text_content || (type === 'image' ? 'Image upload' : 'Document upload'),
  );

  if (type === 'equation') {
    return `
      <div class="evidence-equation">
        <i class="fas ${fileIcon(type)}"></i>
        <code>${label}</code>
      </div>
    `;
  }

  return `
    <a class="evidence-chip evidence-${escapeHtml(type)}" href="${escapeHtml(url || '#')}" target="_blank" rel="noreferrer">
      ${
        type === 'image' && url
          ? `<img src="${escapeHtml(url)}" alt="${label}" />`
          : `<i class="fas ${fileIcon(type)}"></i>`
      }
      <span>${label}</span>
    </a>
  `;
}

function renderEvidenceForm(memberData, goalData) {
  return `
    <form class="evidence-upload-form work-check-form" data-user-id="${memberData.user_id}" data-goal-id="${goalData.id}">
      <label>
        <span>Written equations or note</span>
        <textarea name="equation_text" rows="2" placeholder="Type workings or a completion note"></textarea>
      </label>
      <div class="evidence-upload-row">
        <input name="evidence_file" type="file" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        <div class="evidence-action-group">
          <button class="submit-evidence-button" type="submit" data-action="submit">
            <i class="fas fa-upload"></i>
            <span>Submit</span>
          </button>
          <button class="ai-review-button" type="submit" data-action="review">
            <i class="fas fa-search"></i>
            <span>AI Review</span>
          </button>
        </div>
      </div>
      <div class="work-check-feedback d-none" aria-live="polite"></div>
      <section class="work-check-history" data-user-id="${memberData.user_id}" data-goal-id="${goalData.id}">
        <div class="work-check-history-heading">
          <strong>Previous AI checks</strong>
          <span>Newest first</span>
        </div>
        <div class="work-check-history-list">${emptyText('Loading AI feedback history...', 'work-check-empty')}</div>
      </section>
    </form>
  `;
}
